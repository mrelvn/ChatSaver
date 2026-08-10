package dev.chatsaver.api.error;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail handleInvalidRequest(
            MethodArgumentNotValidException exception,
            HttpServletRequest request) {
        ProblemDetail problem = baseProblem(
                HttpStatus.BAD_REQUEST,
                "Request validation failed",
                "One or more request fields are invalid.",
                request);

        Map<String, String> errors = new LinkedHashMap<>();
        for (FieldError fieldError : exception.getBindingResult().getFieldErrors()) {
            errors.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage());
        }
        problem.setProperty("errors", errors);
        return problem;
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ProblemDetail handleConstraintViolation(
            ConstraintViolationException exception,
            HttpServletRequest request) {
        ProblemDetail problem = baseProblem(
                HttpStatus.BAD_REQUEST,
                "Request constraint failed",
                "A request value did not satisfy its required constraints.",
                request);
        problem.setProperty(
                "violations",
                exception.getConstraintViolations().stream()
                        .map(violation -> Map.of(
                                "path", violation.getPropertyPath().toString(),
                                "message", violation.getMessage()))
                        .toList());
        return problem;
    }

    private ProblemDetail baseProblem(
            HttpStatus status,
            String title,
            String detail,
            HttpServletRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        problem.setType(URI.create("https://chatsaver.dev/problems/validation"));
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("requestId", request.getAttribute(RequestAttributes.REQUEST_ID));
        return problem;
    }
}

