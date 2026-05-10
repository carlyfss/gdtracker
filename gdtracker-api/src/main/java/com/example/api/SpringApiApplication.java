package com.example.api;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SpringApiApplication {

    private static final Logger log = LoggerFactory.getLogger(SpringApiApplication.class);

    public static void main(String[] args) {
        log.warn("gdtracker-api (Spring) is deprecated and unsupported — use gdtracker-go-api for new development");
        SpringApplication.run(SpringApiApplication.class, args);
    }
}
