package com.linh.document.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.linh.document.constants.DocumentContract;
import com.linh.document.exception.DocumentErrorHandler;
import com.linh.document.filter.UploadAuthorizationFilter;
import com.linh.document.model.DocumentRecord;
import com.linh.document.services.UploadService;
import com.linh.document.services.ports.UploadPorts.AuthorizationGateway;
import com.linh.document.services.ports.UploadPorts.AuthorizedUploader;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class UploadHttpTest {
    private static final String COURSE_ID = "course-a";
    private static final String PATH = "/api/v1/courses/course-a/documents";
    private static final String COOKIE = "session=trusted";
    private static final String KEY = "upload-a";
    private static final String USER_ID = "user-a";
    private static final String TENANT_ID = "tenant-a";
    private static final long MAX_BYTES = 1024L;
    @Mock private AuthorizationGateway authorization;
    @Mock private UploadService service;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        UploadController controller = new UploadController(service, MAX_BYTES);
        UploadAuthorizationFilter filter = new UploadAuthorizationFilter(authorization, new ObjectMapper());
        mvc = MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(new DocumentErrorHandler())
                .addFilters(filter).build();
    }

    @Test
    void rejectsAnonymousUploadBeforeReadingPdf() throws Exception {
        mvc.perform(multipart(PATH).file(pdf()).header(DocumentContract.IDEMPOTENCY_HEADER, KEY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.errorCode").value("DOCUMENT_UNAUTHENTICATED"));
        verify(authorization, never()).authorize(any(), any());
        verify(service, never()).upload(any(), any(), any(), any(), any());
    }

    @Test
    void passesTrustedIdentityToUploadService() throws Exception {
        AuthorizedUploader uploader = new AuthorizedUploader(TENANT_ID, USER_ID);
        when(authorization.authorize(COURSE_ID, COOKIE)).thenReturn(uploader);
        when(service.upload(eq(COURSE_ID), eq(KEY), eq("lesson.pdf"), any(), eq(uploader)))
                .thenReturn(new DocumentRecord("document-a", TENANT_ID, COURSE_ID, USER_ID,
                        KEY, "lesson.pdf", "checksum", "storage-key", DocumentContract.QUEUED,
                        DocumentContract.INITIAL_DOCUMENT_VERSION, null, null, Instant.EPOCH, Instant.EPOCH));

        mvc.perform(multipart(PATH).file(pdf()).header(DocumentContract.IDEMPOTENCY_HEADER, KEY)
                        .header("Cookie", COOKIE).header("X-Tenant-Id", "attacker-tenant"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.tenantId").value(TENANT_ID));
        verify(service).upload(eq(COURSE_ID), eq(KEY), eq("lesson.pdf"), any(), eq(uploader));
    }

    private MockMultipartFile pdf() {
        return new MockMultipartFile(DocumentContract.FILE_FIELD, "lesson.pdf", DocumentContract.PDF_MIME,
                "%PDF-1.7\ncontent".getBytes(StandardCharsets.US_ASCII));
    }
}
