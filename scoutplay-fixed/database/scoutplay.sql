-- =====================================================================
-- ScoutPlay - banco de dados MySQL 8+ (tambem roda em MariaDB 10.5+)
-- Banco limpo: nenhuma conta, post ou dado de exemplo.
-- As contas sao criadas pela propria tela de cadastro do sistema.
--
-- Como usar: copie tudo e execute no MySQL Workbench, phpMyAdmin,
-- DBeaver ou no terminal:  mysql -u root -p < scoutplay.sql
-- =====================================================================

CREATE DATABASE IF NOT EXISTS scoutplay
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE scoutplay;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS post_reports;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS post_saves;
DROP TABLE IF EXISTS post_likes;
DROP TABLE IF EXISTS stories;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS video_chunks;
DROP TABLE IF EXISTS videos;
DROP TABLE IF EXISTS profile_views;
DROP TABLE IF EXISTS evaluations;
DROP TABLE IF EXISTS shortlist;
DROP TABLE IF EXISTS follows;
DROP TABLE IF EXISTS scout_profiles;
DROP TABLE IF EXISTS athlete_profiles;
DROP TABLE IF EXISTS user_photos;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- Contas (atletas e olheiros). Senha guardada so como hash bcrypt.
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  role          ENUM('athlete','scout') NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  avatar        VARCHAR(16)  NULL,
  photo_id      CHAR(36)     NULL,
  city          VARCHAR(80)  NULL,
  state         CHAR(2)      NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_role_created (role, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Fotos de perfil (guardadas no proprio banco; users.photo_id aponta para a atual)
-- ---------------------------------------------------------------------
CREATE TABLE user_photos (
  id         CHAR(36)     NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  mime       VARCHAR(40)  NOT NULL,
  size       INT UNSIGNED NOT NULL,
  data       MEDIUMBLOB   NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_user_photos_user (user_id),
  CONSTRAINT fk_photo_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Ficha esportiva do atleta (1 para 1 com users)
-- ---------------------------------------------------------------------
CREATE TABLE athlete_profiles (
  user_id       INT UNSIGNED NOT NULL,
  position      VARCHAR(40)  NULL,
  birth_date    DATE         NULL,
  club          VARCHAR(120) NULL,
  category      VARCHAR(40)  NULL,
  dominant_foot ENUM('Direito','Esquerdo','Ambidestro') NULL,
  height_cm     SMALLINT UNSIGNED NULL,
  weight_kg     SMALLINT UNSIGNED NULL,
  traits        VARCHAR(255) NULL,
  bio           TEXT         NULL,
  games         INT UNSIGNED NOT NULL DEFAULT 0,
  goals         INT UNSIGNED NOT NULL DEFAULT 0,
  assists       INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id),
  KEY ix_athlete_position (position),
  CONSTRAINT fk_athlete_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Dados profissionais do olheiro (1 para 1 com users)
-- ---------------------------------------------------------------------
CREATE TABLE scout_profiles (
  user_id          INT UNSIGNED NOT NULL,
  organization     VARCHAR(120) NULL,
  experience_years TINYINT UNSIGNED NULL,
  bio              TEXT NULL,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_scout_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Quem segue quem
-- ---------------------------------------------------------------------
CREATE TABLE follows (
  follower_id INT UNSIGNED NOT NULL,
  followed_id INT UNSIGNED NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, followed_id),
  KEY ix_follows_followed (followed_id),
  CONSTRAINT fk_follows_follower FOREIGN KEY (follower_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_follows_followed FOREIGN KEY (followed_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Shortlist do olheiro (atletas salvos)
-- ---------------------------------------------------------------------
CREATE TABLE shortlist (
  scout_id   INT UNSIGNED NOT NULL,
  athlete_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (scout_id, athlete_id),
  KEY ix_shortlist_athlete (athlete_id),
  CONSTRAINT fk_shortlist_scout   FOREIGN KEY (scout_id)   REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_shortlist_athlete FOREIGN KEY (athlete_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Avaliacao do olheiro sobre o atleta (nota 0-100 + observacao).
-- A nota exibida do atleta e a media dessas avaliacoes.
-- ---------------------------------------------------------------------
CREATE TABLE evaluations (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  scout_id   INT UNSIGNED NOT NULL,
  athlete_id INT UNSIGNED NOT NULL,
  rating     TINYINT UNSIGNED NOT NULL,
  note       TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_evaluation (scout_id, athlete_id),
  KEY ix_evaluation_athlete (athlete_id),
  CONSTRAINT fk_eval_scout   FOREIGN KEY (scout_id)   REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_eval_athlete FOREIGN KEY (athlete_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Visualizacoes de perfil (1 registro por visitante/atleta/dia)
-- ---------------------------------------------------------------------
CREATE TABLE profile_views (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  viewer_id  INT UNSIGNED NOT NULL,
  athlete_id INT UNSIGNED NOT NULL,
  viewed_on  DATE NOT NULL,
  viewed_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_view_day (viewer_id, athlete_id, viewed_on),
  KEY ix_views_athlete (athlete_id, viewed_at),
  CONSTRAINT fk_views_viewer  FOREIGN KEY (viewer_id)  REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_views_athlete FOREIGN KEY (athlete_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Videos ficam no proprio banco, quebrados em pedacos de 1 MB.
-- Assim nao estoura o max_allowed_packet do MySQL e o player
-- consegue avancar o video (requisicoes por faixa de bytes).
-- ---------------------------------------------------------------------
CREATE TABLE videos (
  id         CHAR(36)     NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  mime       VARCHAR(100) NOT NULL,
  size       BIGINT UNSIGNED NOT NULL,
  chunk_size INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_videos_user (user_id),
  CONSTRAINT fk_videos_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE video_chunks (
  video_id CHAR(36)     NOT NULL,
  idx      INT UNSIGNED NOT NULL,
  data     MEDIUMBLOB   NOT NULL,
  PRIMARY KEY (video_id, idx),
  CONSTRAINT fk_chunks_video FOREIGN KEY (video_id) REFERENCES videos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Feed: publicacoes, curtidas, salvos, comentarios e denuncias
-- ---------------------------------------------------------------------
CREATE TABLE posts (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  text       TEXT NOT NULL,
  media      VARCHAR(16) NULL,
  video_id   CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_posts_user (user_id),
  KEY ix_posts_video (video_id),
  CONSTRAINT fk_posts_user  FOREIGN KEY (user_id)  REFERENCES users (id)  ON DELETE CASCADE,
  CONSTRAINT fk_posts_video FOREIGN KEY (video_id) REFERENCES videos (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE post_likes (
  post_id    INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id),
  KEY ix_likes_user (user_id),
  CONSTRAINT fk_likes_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_likes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE post_saves (
  post_id    INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id),
  KEY ix_saves_user (user_id),
  CONSTRAINT fk_saves_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_saves_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE comments (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  post_id    INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  text       VARCHAR(1000) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_comments_post (post_id, id),
  CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE post_reports (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  post_id    INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_report (post_id, user_id),
  CONSTRAINT fk_reports_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_reports_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Stories (somem do feed apos 24h; o servidor apaga os antigos)
-- ---------------------------------------------------------------------
CREATE TABLE stories (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  caption    VARCHAR(60)  NULL,
  file_name  VARCHAR(255) NULL,
  video_id   CHAR(36)     NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_stories_created (created_at),
  CONSTRAINT fk_stories_user  FOREIGN KEY (user_id)  REFERENCES users (id)  ON DELETE CASCADE,
  CONSTRAINT fk_stories_video FOREIGN KEY (video_id) REFERENCES videos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Notificacoes reais (curtida, comentario, seguidor, visita, shortlist)
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  actor_id   INT UNSIGNED NOT NULL,
  type       ENUM('like','comment','follow','view','shortlist','evaluation') NOT NULL,
  post_id    INT UNSIGNED NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_notif_user (user_id, is_read, created_at),
  CONSTRAINT fk_notif_user  FOREIGN KEY (user_id)  REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_post  FOREIGN KEY (post_id)  REFERENCES posts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- (Opcional) usuario proprio para a aplicacao, em vez de usar o root.
-- Tire os "--" das 3 linhas abaixo e troque a senha antes de rodar.
-- ---------------------------------------------------------------------
-- CREATE USER IF NOT EXISTS 'scoutplay'@'%' IDENTIFIED BY 'TROQUE_POR_UMA_SENHA_FORTE';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON scoutplay.* TO 'scoutplay'@'%';
-- FLUSH PRIVILEGES;
