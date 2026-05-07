SELECT CAST(t.feature_id AS varchar) AS fid,
       CAST(COUNT(*) AS bigint) AS total_cnt,
       CAST(COUNT(*) FILTER (WHERE t.status = 'DONE') AS bigint) AS done_cnt
FROM tasks t
INNER JOIN features f ON f.id = t.feature_id
WHERE f.game_id = :gameId
AND f.archived = false
AND t.archived = false
GROUP BY t.feature_id
