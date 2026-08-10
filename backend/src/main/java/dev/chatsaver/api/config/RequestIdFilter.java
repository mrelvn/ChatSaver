package dev.chatsaver.api.config;

import java.io.IOException;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import dev.chatsaver.api.error.RequestAttributes;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class RequestIdFilter extends OncePerRequestFilter {

    public static final String HEADER_NAME = "X-Request-Id";
    private static final String MDC_KEY = "requestId";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String suppliedRequestId = request.getHeader(HEADER_NAME);
        String requestId = isSafeRequestId(suppliedRequestId)
                ? suppliedRequestId
                : UUID.randomUUID().toString();

        request.setAttribute(RequestAttributes.REQUEST_ID, requestId);
        response.setHeader(HEADER_NAME, requestId);
        MDC.put(MDC_KEY, requestId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }

    private boolean isSafeRequestId(String value) {
        return StringUtils.hasText(value)
                && value.length() <= 100
                && value.chars().allMatch(character ->
                        Character.isLetterOrDigit(character)
                                || character == '-'
                                || character == '_');
    }
}

