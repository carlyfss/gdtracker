package com.example.api.repository;

import com.example.api.model.ArchivedFeature;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ArchivedFeatureRepository extends JpaRepository<ArchivedFeature, String> {
    Optional<ArchivedFeature> findByRestoredFeature_Id(String restoredFeatureId);
}
