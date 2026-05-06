package com.example.api.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Entity
@Table(name = "game_exceptions")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class GameException {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    private String errorMessage;
    private String location;
    private String map;

    @Column(columnDefinition = "TEXT")
    private String stackTrace;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "game_id", nullable = false)
    private Game game;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    @Column(nullable = false, updatable = false)
    private Instant timestamp;

    public GameException(String errorMessage, String location, String map) {
        this.errorMessage = errorMessage;
        this.location = location;
        this.map = map;
    }

    @PrePersist
    private void onCreate() {
        if (timestamp == null) {
            timestamp = Instant.now();
        }
    }
}
