package com.linh.document.entity;
import static org.junit.jupiter.api.Assertions.*;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

class UploadPdfFixtureTest {
    @Test void uploadFixtureContainsAReadablePageAndText() throws Exception {
        byte[] bytes;
        try(var input=getClass().getResourceAsStream("/upload-r1.pdf")) {
            assertNotNull(input);bytes=input.readAllBytes();
        }
        try(var pdf=Loader.loadPDF(bytes)) {
            assertEquals(1,pdf.getNumberOfPages());
            assertTrue(new PDFTextStripper().getText(pdf).contains("R1 authorized upload fixture"));
        }
    }
}
