package com.example.api.repository;

import com.example.api.model.Category;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CategoryRepository extends JpaRepository<Category, String> {
    List<Category> findByGameIdOrderByNameAsc(String gameId);

    Optional<Category> findByGameIdAndNameIgnoreCase(String gameId, String name);

    boolean existsByGameIdAndNameIgnoreCase(String gameId, String name);

    Optional<Category> findByIdAndGameId(String id, String gameId);
}
