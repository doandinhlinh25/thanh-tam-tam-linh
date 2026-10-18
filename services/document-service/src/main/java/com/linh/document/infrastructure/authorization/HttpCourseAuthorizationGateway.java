package com.linh.document.infrastructure.authorization;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.linh.document.exception.DocumentException;
import com.linh.document.services.ports.UploadPorts.AuthorizationGateway;
import com.linh.document.services.ports.UploadPorts.AuthorizedUploader;
import java.net.URI;
import java.time.Duration;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Confirms a user's course permission with Tenant Service. */
@Component
public class HttpCourseAuthorizationGateway implements AuthorizationGateway {
    private static final String COURSE_ID_FIELD = "courseId";
    private static final String DATA_FIELD = "data";
    private static final String SUCCESS_FIELD = "successful";
    private static final String ALLOWED_FIELD = "allowed";
    private static final String TENANT_FIELD = "tenantId";
    private static final String USER_FIELD = "userId";
    private static final String BEARER_PREFIX = "Bearer ";
    private static final String UNAUTHENTICATED_CODE = "DOCUMENT_UNAUTHENTICATED";
    private static final String UNAUTHENTICATED_MESSAGE = "Chưa có phiên đăng nhập hợp lệ";
    private static final String DENIED_CODE = "DOCUMENT_ACCESS_DENIED";
    private static final String DENIED_MESSAGE = "Không có quyền tải tài liệu lên môn học";
    private static final String UNAVAILABLE_CODE = "DOCUMENT_DEPENDENCY_UNAVAILABLE";
    private static final String UNAVAILABLE_MESSAGE = "Dịch vụ phụ thuộc chưa sẵn sàng";
    private final URI url;
    private final String serviceToken;
    private final RestClient client;
    private final ObjectMapper objectMapper;

    /**
     * Configures the internal authorization call and timeout.
     *
     * @param url internal Tenant Service URL
     * @param serviceToken service credential
     * @param timeoutMs request timeout in milliseconds
     * @param objectMapper JSON response parser
     */
    public HttpCourseAuthorizationGateway(@Value("${document.authorization.url}") String url,
            @Value("${document.authorization.token}") String serviceToken,
            @Value("${document.authorization.timeout-ms}") long timeoutMs, ObjectMapper objectMapper) {
        this.url = URI.create(url);
        this.serviceToken = serviceToken;
        this.objectMapper = objectMapper;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(timeoutMs));
        requestFactory.setReadTimeout(Duration.ofMillis(timeoutMs));
        this.client = RestClient.builder().requestFactory(requestFactory).build();
    }

    /**
     * Returns the tenant and user IDs only after Tenant Service permits the action.
     *
     * @param courseId requested course
     * @param cookie original user session cookie
     * @return trusted tenant and uploader
     */
    @Override
    public AuthorizedUploader authorize(String courseId, String cookie) {
        try {
            JsonNode response = client.post().uri(url)
                    .header(HttpHeaders.AUTHORIZATION, BEARER_PREFIX + serviceToken)
                    .header(HttpHeaders.COOKIE, cookie).contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(COURSE_ID_FIELD, courseId)).exchange((request, result) -> {
                        int status = result.getStatusCode().value();
                        if (status == HttpStatus.UNAUTHORIZED.value()) {
                            throw new DocumentException(HttpStatus.UNAUTHORIZED, UNAUTHENTICATED_CODE,
                                    UNAUTHENTICATED_MESSAGE);
                        }
                        if (status == HttpStatus.FORBIDDEN.value()) {
                            throw new DocumentException(HttpStatus.FORBIDDEN, DENIED_CODE, DENIED_MESSAGE);
                        }
                        if (!result.getStatusCode().is2xxSuccessful()) {
                            throw unavailable();
                        }
                        return objectMapper.readTree(result.getBody());
                    });
            JsonNode data = response.path(DATA_FIELD);
            if (response.path(SUCCESS_FIELD).asBoolean() && data.path(ALLOWED_FIELD).isBoolean()
                    && !data.path(ALLOWED_FIELD).asBoolean()) {
                throw new DocumentException(HttpStatus.FORBIDDEN, DENIED_CODE, DENIED_MESSAGE);
            }
            if (!hasAuthorizedIdentity(response)) {
                throw unavailable();
            }
            return new AuthorizedUploader(data.path(TENANT_FIELD).asText(), data.path(USER_FIELD).asText());
        } catch (DocumentException error) {
            throw error;
        } catch (Exception error) {
            throw unavailable();
        }
    }

    private boolean hasAuthorizedIdentity(JsonNode response) {
        JsonNode data = response.path(DATA_FIELD);
        return response.path(SUCCESS_FIELD).asBoolean() && data.path(ALLOWED_FIELD).asBoolean()
                && data.path(TENANT_FIELD).isTextual() && !data.path(TENANT_FIELD).asText().isBlank()
                && data.path(USER_FIELD).isTextual() && !data.path(USER_FIELD).asText().isBlank();
    }

    private DocumentException unavailable() {
        return new DocumentException(HttpStatus.SERVICE_UNAVAILABLE, UNAVAILABLE_CODE, UNAVAILABLE_MESSAGE);
    }
}
