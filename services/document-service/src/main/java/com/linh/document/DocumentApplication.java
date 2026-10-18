package com.linh.document;

import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

/** Starts the isolated Document Service API. */
@SpringBootApplication
public class DocumentApplication {
    /**
     * Starts the Spring Boot process.
     *
     * @param arguments command line arguments
     */
    public static void main(String[] arguments) {
        SpringApplication.run(DocumentApplication.class, arguments);
    }

    /**
     * Creates an AWS SDK client for a private S3 compatible bucket.
     *
     * @param region bucket region
     * @param endpoint optional S3 compatible endpoint
     * @return configured client
     */
    @Bean
    public S3Client documentS3Client(@Value("${document.s3.region}") String region,
            @Value("${document.s3.endpoint}") String endpoint) {
        var builder = S3Client.builder().region(Region.of(region));
        if (!endpoint.isBlank()) {
            builder.endpointOverride(URI.create(endpoint));
            builder.serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build());
        }
        return builder.build();
    }
}
