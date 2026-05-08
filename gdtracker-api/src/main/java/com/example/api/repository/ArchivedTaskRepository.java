package com.example.api.repository;

import com.example.api.model.ArchivedTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ArchivedTaskRepository extends JpaRepository<ArchivedTask, String> {}
