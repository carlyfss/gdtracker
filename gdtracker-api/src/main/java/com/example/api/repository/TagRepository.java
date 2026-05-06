package com.example.api.repository;

import com.example.api.model.Tag;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TagRepository extends JpaRepository<Tag, String> {

    List<Tag> findByGameIdOrderByNameAsc(String gameId);

    Optional<Tag> findByGameIdAndNameIgnoreCase(String gameId, String name);

    boolean existsByGameIdAndNameIgnoreCase(String gameId, String name);

    Optional<Tag> findByIdAndGameId(String id, String gameId);

    @Query("SELECT t FROM Tag t WHERE t.id IN :ids AND t.game.id = :gameId")
    List<Tag> findAllByIdInAndGameId(@Param("ids") Collection<String> ids, @Param("gameId") String gameId);
}
