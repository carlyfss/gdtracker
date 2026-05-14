CREATE TABLE task_planning_document_refs (
    task_id           VARCHAR(36) NOT NULL,
    planning_node_id  VARCHAR(36) NOT NULL,
    sort_order        INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (task_id, planning_node_id),
    CONSTRAINT fk_task_planning_document_refs_task
        FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_task_planning_document_refs_planning
        FOREIGN KEY (planning_node_id) REFERENCES planning_nodes (id) ON DELETE CASCADE
);

CREATE INDEX idx_task_planning_document_refs_planning_node
    ON task_planning_document_refs (planning_node_id);
