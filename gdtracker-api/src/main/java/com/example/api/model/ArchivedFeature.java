package com.example.api.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "archived_features")
@Getter
@Setter
@NoArgsConstructor
public class ArchivedFeature {

    @Id
    @Column(name = "feature_id", nullable = false, length = 36)
    private String featureId;

    @JsonIgnore
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "feature_id", nullable = false, insertable = false, updatable = false)
    private Feature feature;

    @Column(name = "archived_at", nullable = false)
    private Instant archivedAt;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restored_feature_id")
    private Feature restoredFeature;
}
