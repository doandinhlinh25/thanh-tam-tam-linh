package com.linh.document.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.linh.document.constants.DocumentContract;
import com.linh.document.dto.response.ApiResponse;
import com.linh.document.exception.DocumentException;
import com.linh.document.services.ports.UploadPorts.AuthorizationGateway;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Checks course permission before the multipart PDF is parsed. */
@Component
public class UploadAuthorizationFilter extends OncePerRequestFilter {
    private static final String POST_METHOD = "POST";
    private static final String PATH_SEPARATOR = "/";
    private static final String UNAUTHENTICATED_CODE = "DOCUMENT_UNAUTHENTICATED";
    private static final String UNAUTHENTICATED_MESSAGE = "Chưa có phiên đăng nhập hợp lệ";
    private static final String INVALID_REQUEST_CODE = "DOCUMENT_UPLOAD_INVALID";
    private static final String INVALID_REQUEST_MESSAGE = "Yêu cầu upload không hợp lệ";
    private final AuthorizationGateway authorization;
    private final ObjectMapper objectMapper;

    /**
     * Creates the early course authorization boundary.
     *
     * @param authorization course permission gateway
     * @param objectMapper JSON response writer
     */
    public UploadAuthorizationFilter(AuthorizationGateway authorization, ObjectMapper objectMapper) {
        this.authorization = authorization;
        this.objectMapper = objectMapper;
    }

    /**
     * Authorizes upload without trusting tenant or user headers from the client.
     *
     * @param request inbound HTTP request
     * @param response outbound HTTP response
     * @param chain remaining request processing
     * @throws ServletException when downstream servlet processing fails
     * @throws IOException when response writing fails
     */
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        if (!isUploadRequest(request.getMethod(), path)) {
            chain.doFilter(request, response);
            return;
        }
        String courseId = path.substring(DocumentContract.UPLOAD_PREFIX.length(),
                path.length() - DocumentContract.UPLOAD_SUFFIX.length());
        String cookie = request.getHeader(HttpHeaders.COOKIE);
        try {
            if (courseId.isBlank() || courseId.contains(PATH_SEPARATOR)) {
                throw new DocumentException(HttpStatus.BAD_REQUEST, INVALID_REQUEST_CODE, INVALID_REQUEST_MESSAGE);
            }
            if (cookie == null || cookie.isBlank()) {
                throw new DocumentException(HttpStatus.UNAUTHORIZED, UNAUTHENTICATED_CODE, UNAUTHENTICATED_MESSAGE);
            }
            request.setAttribute(DocumentContract.UPLOADER_ATTRIBUTE, authorization.authorize(courseId, cookie));
        } catch (DocumentException error) {
            response.setStatus(error.status().value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            ApiResponse.ApiError details = new ApiResponse.ApiError(error.code(), error.getMessage(), Map.of());
            objectMapper.writeValue(response.getOutputStream(), ApiResponse.failure(details));
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean isUploadRequest(String method, String path) {
        return POST_METHOD.equals(method) && path.startsWith(DocumentContract.UPLOAD_PREFIX)
                && path.endsWith(DocumentContract.UPLOAD_SUFFIX);
    }
}
