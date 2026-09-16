package org.example.saas.commonlib.format.datetime;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Objects;

/**
 * Provides the shared ISO date and time representation for every API service.
 */
public final class ApiDateTimeFormatter {

    private static final DateTimeFormatter API_INSTANT_FORMATTER = DateTimeFormatter.ISO_INSTANT;
    private static final DateTimeFormatter API_LOCAL_DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter API_OFFSET_DATE_TIME_FORMATTER =
            DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private ApiDateTimeFormatter() {
    }

    /**
     * Formats an instant using the shared API instant representation.
     *
     * @param instantValue instant to format
     * @return formatted instant value
     */
    public static String formatInstant(Instant instantValue) {
        return API_INSTANT_FORMATTER.format(Objects.requireNonNull(instantValue));
    }

    /**
     * Parses an instant using the shared API instant representation.
     *
     * @param instantValue formatted instant value
     * @return parsed instant
     */
    public static Instant parseInstant(String instantValue) {
        return Instant.from(API_INSTANT_FORMATTER.parse(Objects.requireNonNull(instantValue)));
    }

    /**
     * Formats a local date using the shared API date representation.
     *
     * @param localDateValue local date to format
     * @return formatted local date value
     */
    public static String formatLocalDate(LocalDate localDateValue) {
        return API_LOCAL_DATE_FORMATTER.format(Objects.requireNonNull(localDateValue));
    }

    /**
     * Parses a local date using the shared API date representation.
     *
     * @param localDateValue formatted local date value
     * @return parsed local date
     */
    public static LocalDate parseLocalDate(String localDateValue) {
        return LocalDate.parse(Objects.requireNonNull(localDateValue), API_LOCAL_DATE_FORMATTER);
    }

    /**
     * Formats an offset date-time using the shared API date-time representation.
     *
     * @param offsetDateTimeValue offset date-time to format
     * @return formatted offset date-time value
     */
    public static String formatOffsetDateTime(OffsetDateTime offsetDateTimeValue) {
        return API_OFFSET_DATE_TIME_FORMATTER.format(Objects.requireNonNull(offsetDateTimeValue));
    }

    /**
     * Parses an offset date-time using the shared API date-time representation.
     *
     * @param offsetDateTimeValue formatted offset date-time value
     * @return parsed offset date-time
     */
    public static OffsetDateTime parseOffsetDateTime(String offsetDateTimeValue) {
        return OffsetDateTime.parse(
                Objects.requireNonNull(offsetDateTimeValue),
                API_OFFSET_DATE_TIME_FORMATTER);
    }
}
