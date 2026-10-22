package com.linh.document.entity;

import com.linh.document.constants.DocumentContract;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocumentsValidationTest {
    private static final String IDENTIFIER = "document-1";
    private static final String FILE_NAME = "lesson.pdf";
    private static final String STORAGE_KEY = "tenant/course/document-1/1.pdf";
    private static final String VALID_CHECKSUM = "a".repeat(64);
    private static final String INVALID_CHECKSUM = "invalid";
    private static final String BLANK = " ";
    private static final long VALID_BYTE_SIZE = 1L;
    private static final long INVALID_BYTE_SIZE = 0L;
    private static final int INVALID_PAGE_COUNT = 0;
    private static final String DOCUMENT_ID_PROPERTY = "documentId";
    private static final String FILE_NAME_PROPERTY = "fileName";
    private static final String BYTE_SIZE_PROPERTY = "byteSize";
    private static final String CHECKSUM_PROPERTY = "checksumSha256";
    private static final String PAGE_COUNT_PROPERTY = "pageCount";
    private static final String FAILURE_CODE_PROPERTY = "failureCode";

    @Test
    void acceptsValidDocumentBeforeDatabaseGeneratedTimestampsExist() {
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            Validator validator = factory.getValidator();
            assertTrue(validator.validate(validDocument()).isEmpty());
        }
    }

    @Test
    void rejectsInvalidRequiredAndOptionalColumnValues() {
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            Validator validator = factory.getValidator();
            Documents document = new Documents(BLANK, IDENTIFIER, IDENTIFIER, IDENTIFIER, IDENTIFIER,
                    FILE_NAME.repeat(DocumentContract.MAX_FILE_NAME_LENGTH), INVALID_BYTE_SIZE,
                    INVALID_CHECKSUM, STORAGE_KEY, DocumentContract.COURSE_SCOPE, DocumentContract.UPLOADED,
                    DocumentContract.INITIAL_DOCUMENT_VERSION, INVALID_PAGE_COUNT, BLANK, null, null);
            Set<String> properties = validator.validate(document).stream()
                    .map(violation -> violation.getPropertyPath().toString())
                    .collect(Collectors.toSet());
            assertEquals(Set.of(DOCUMENT_ID_PROPERTY, FILE_NAME_PROPERTY, BYTE_SIZE_PROPERTY,
                    CHECKSUM_PROPERTY, PAGE_COUNT_PROPERTY, FAILURE_CODE_PROPERTY), properties);
        }
    }

    private Documents validDocument() {
        return new Documents(IDENTIFIER, IDENTIFIER, IDENTIFIER, IDENTIFIER, IDENTIFIER, FILE_NAME,
                VALID_BYTE_SIZE, VALID_CHECKSUM, STORAGE_KEY, DocumentContract.COURSE_SCOPE,
                DocumentContract.UPLOADED, DocumentContract.INITIAL_DOCUMENT_VERSION, null, null, null, null);
    }
}
