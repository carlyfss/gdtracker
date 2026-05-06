package com.example.api.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "game_event_definitions")
@Getter
@Setter
@NoArgsConstructor
public class GameEventDefinition {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false, length = 64)
    private String code;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "message_template", nullable = false, length = 100)
    private String messageTemplate;

    @Column(name = "image_data", columnDefinition = "TEXT")
    private String imageData;

    @Column(nullable = false, length = 7)
    private String color = Feature.DEFAULT_COLOR;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "game_id", nullable = false)
    private Game game;

    public GameEventDefinition(String code, String messageTemplate, Game game) {
        this.code = code;
        this.messageTemplate = messageTemplate;
        this.game = game;
    }
}
