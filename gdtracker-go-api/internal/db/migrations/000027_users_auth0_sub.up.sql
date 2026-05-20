ALTER TABLE users ADD COLUMN auth0_sub VARCHAR(255);

CREATE UNIQUE INDEX uk_users_auth0_sub ON users (auth0_sub) WHERE auth0_sub IS NOT NULL;
