package com.linh.document.services.authorization.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.linh.document.exception.DocumentException;
import com.linh.document.services.authorization.AuthorizedUploader;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class HttpCourseAuthorizationGatewayImplTest {
    private static final String AUTHORIZATION_PATH = "/internal/authorization/course";
    private static final String COURSE_ID = "507f1f77bcf86cd799439011";
    private static final String COOKIE = "tokenAdmin=authenticated-session";
    private static final String SERVICE_TOKEN = "test-document-credential-at-least-32-characters";
    private static final String TENANT_ID = "507f191e810c19729de860ea";
    private static final String USER_ID = "507f1f77bcf86cd799439012";
    private static final String ALLOWED_RESPONSE = "{\"successful\":true,\"data\":{\"allowed\":true,\"tenantId\":\""
            + TENANT_ID + "\",\"userId\":\"" + USER_ID + "\"}}";
    private static final String DENIED_RESPONSE = "{\"code\":\"error\",\"message\":\"Forbidden\"}";
    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String COOKIE_HEADER = "Cookie";
    private static final String BEARER_PREFIX = "Bearer ";
    private static final long TIMEOUT_MILLIS = 3000L;
    private final AtomicInteger responseStatus = new AtomicInteger(HttpStatus.OK.value());
    private final AtomicReference<String> responseBody = new AtomicReference<>(ALLOWED_RESPONSE);
    private final AtomicReference<String> receivedAuthorization = new AtomicReference<>();
    private final AtomicReference<String> receivedCookie = new AtomicReference<>();
    private final AtomicReference<String> receivedBody = new AtomicReference<>();
    private HttpServer server;
    private HttpCourseAuthorizationGatewayImpl gateway;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext(AUTHORIZATION_PATH, exchange -> {
            receivedAuthorization.set(exchange.getRequestHeaders().getFirst(AUTHORIZATION_HEADER));
            receivedCookie.set(exchange.getRequestHeaders().getFirst(COOKIE_HEADER));
            receivedBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] bytes = responseBody.get().getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(responseStatus.get(), bytes.length);
            try (var output = exchange.getResponseBody()) {
                output.write(bytes);
            }
        });
        server.start();
        String url = "http://localhost:" + server.getAddress().getPort() + AUTHORIZATION_PATH;
        gateway = new HttpCourseAuthorizationGatewayImpl(url, SERVICE_TOKEN, TIMEOUT_MILLIS,
                new ObjectMapper());
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void sendsCourseCookieAndServiceCredentialToTenant() {
        AuthorizedUploader uploader = gateway.authorize(COURSE_ID, COOKIE);

        assertEquals(TENANT_ID, uploader.tenantId());
        assertEquals(USER_ID, uploader.userId());
        assertEquals(BEARER_PREFIX + SERVICE_TOKEN, receivedAuthorization.get());
        assertEquals(COOKIE, receivedCookie.get());
        assertEquals("{\"courseId\":\"" + COURSE_ID + "\"}", receivedBody.get());
    }

    @Test
    void rejectsMissingSessionBeforeCallingTenant() {
        DocumentException error = assertThrows(DocumentException.class,
                () -> gateway.authorize(COURSE_ID, null));

        assertEquals(HttpStatus.UNAUTHORIZED, error.status());
        assertNull(receivedBody.get());
    }

    @Test
    void propagatesTenantCourseDenial() {
        responseStatus.set(HttpStatus.FORBIDDEN.value());
        responseBody.set(DENIED_RESPONSE);

        DocumentException error = assertThrows(DocumentException.class,
                () -> gateway.authorize(COURSE_ID, COOKIE));

        assertEquals(HttpStatus.FORBIDDEN, error.status());
    }
}
