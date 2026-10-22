package com.linh.document;

import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

/** Khởi động API độc lập của Document Service. */
@SpringBootApplication
public class DocumentApplication {
    /**
     * Khởi động ứng dụng Spring Boot.
     *
     * @param arguments các đối số dòng lệnh
     */
    public static void main(String[] arguments) {
        SpringApplication.run(DocumentApplication.class, arguments);
    }

    /**
     * Tạo ứng dụng khách AWS SDK cho bucket riêng tương thích với S3.
     *
     * @param region vùng của bucket
     * @param endpoint địa chỉ S3 tương thích, nếu có
     * @return ứng dụng khách đã cấu hình
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
