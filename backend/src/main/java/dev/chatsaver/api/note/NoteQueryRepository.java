package dev.chatsaver.api.note;

import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.web.server.ResponseStatusException;

@Repository
public class NoteQueryRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public NoteQueryRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public NotePage findPage(
            UUID userId,
            String query,
            NoteView view,
            String encodedCursor,
            int requestedLimit) {
        int limit = Math.clamp(requestedLimit, 1, 100);
        Cursor cursor = decodeCursor(encodedCursor);
        String normalizedQuery = query == null ? "" : query.trim();

        StringBuilder sql = new StringBuilder("""
                SELECT
                    n.id,
                    n.title,
                    n.is_favorite,
                    n.is_archived,
                    n.version,
                    n.created_at,
                    n.updated_at,
                    coalesce(c.source, 'MANUAL') AS source,
                    (
                        SELECT count(*)
                        FROM note_block nb
                        WHERE nb.note_id = n.id
                    ) AS block_count
                FROM note n
                LEFT JOIN conversation c
                    ON c.id = n.conversation_id
                    AND c.user_id = n.user_id
                WHERE n.user_id = :userId
                """);
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("userId", userId);
        parameters.put("limit", limit + 1);

        switch (view) {
            case ALL -> sql.append(" AND n.is_archived = false");
            case FAVORITES -> sql.append(" AND n.is_archived = false AND n.is_favorite = true");
            case IMPORTED -> sql.append(" AND n.is_archived = false AND c.source = 'CHATGPT'");
            case ARCHIVED -> sql.append(" AND n.is_archived = true");
        }

        if (!normalizedQuery.isBlank()) {
            sql.append("""
                     AND (
                        to_tsvector('simple', coalesce(n.title, ''))
                            @@ plainto_tsquery('simple', :query)
                        OR EXISTS (
                            SELECT 1
                            FROM note_block search_block
                            WHERE search_block.note_id = n.id
                                AND to_tsvector(
                                    'simple',
                                    coalesce(search_block.question_text, '')
                                        || ' '
                                        || coalesce(search_block.answer_text, '')
                                ) @@ plainto_tsquery('simple', :query)
                        )
                    )
                    """);
            parameters.put("query", normalizedQuery);
        }

        if (cursor != null) {
            sql.append("""
                     AND (
                        n.updated_at < :cursorUpdatedAt
                        OR (n.updated_at = :cursorUpdatedAt AND n.id < :cursorId)
                    )
                    """);
            parameters.put("cursorUpdatedAt", cursor.updatedAt());
            parameters.put("cursorId", cursor.id());
        }

        sql.append(" ORDER BY n.updated_at DESC, n.id DESC LIMIT :limit");
        List<NoteSummary> rows = jdbc.query(sql.toString(), parameters, NoteQueryRepository::mapNote);
        boolean hasMore = rows.size() > limit;
        List<NoteSummary> items = hasMore
                ? new ArrayList<>(rows.subList(0, limit))
                : rows;
        String nextCursor = hasMore && !items.isEmpty()
                ? encodeCursor(items.getLast())
                : null;
        return new NotePage(items, nextCursor, hasMore, limit);
    }

    private static NoteSummary mapNote(ResultSet resultSet, int rowNumber) throws SQLException {
        return new NoteSummary(
                resultSet.getObject("id", UUID.class),
                resultSet.getString("title"),
                resultSet.getBoolean("is_favorite"),
                resultSet.getBoolean("is_archived"),
                resultSet.getString("source"),
                resultSet.getLong("block_count"),
                resultSet.getLong("version"),
                toInstant(resultSet, "created_at"),
                toInstant(resultSet, "updated_at"));
    }

    private static Instant toInstant(ResultSet resultSet, String column) throws SQLException {
        Timestamp timestamp = resultSet.getTimestamp(column);
        if (timestamp == null) {
            throw new SQLException("Expected a timestamp in " + column + ".");
        }
        return timestamp.toInstant();
    }

    private static String encodeCursor(NoteSummary note) {
        String raw = note.updatedAt() + "|" + note.id();
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    private static Cursor decodeCursor(String encodedCursor) {
        if (encodedCursor == null || encodedCursor.isBlank()) {
            return null;
        }
        try {
            String raw = new String(
                    Base64.getUrlDecoder().decode(encodedCursor),
                    StandardCharsets.UTF_8);
            String[] parts = raw.split("\\|", 2);
            if (parts.length != 2) {
                throw new IllegalArgumentException("Cursor shape is invalid.");
            }
            return new Cursor(Instant.parse(parts[0]), UUID.fromString(parts[1]));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The pagination cursor is invalid.");
        }
    }

    public enum NoteView {
        ALL,
        FAVORITES,
        IMPORTED,
        ARCHIVED
    }

    public record NotePage(
            List<NoteSummary> items,
            String nextCursor,
            boolean hasMore,
            int limit) {
    }

    public record NoteSummary(
            UUID id,
            String title,
            boolean favorite,
            boolean archived,
            String source,
            long blockCount,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    private record Cursor(Instant updatedAt, UUID id) {
    }
}
