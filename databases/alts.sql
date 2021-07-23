CREATE TABLE IF NOT EXISTS alts (
    cur TEXT NOT NULL, -- name they switched into
    prev TEXT NOT NULL, -- name they switched from
    PRIMARY KEY (cur, prev)
);