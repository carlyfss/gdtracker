package com.example.api.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Application user. Passwords are stored in plaintext for local/testing only — never use this
 * pattern in production.
 */
@Entity
@Table(
        name = "users",
        uniqueConstraints = {
            @UniqueConstraint(
                    name = "uk_users_username",
                    columnNames = {"username"})
        })
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false, length = 255)
    private String username;

    /** Plaintext password for dev/testing only. */
    @JsonIgnore
    @Column(nullable = false, length = 255)
    private String password;

    public User(String username, String password) {
        this.username = username;
        this.password = password;
    }
}
