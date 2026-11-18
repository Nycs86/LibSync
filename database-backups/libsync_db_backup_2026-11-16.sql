-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: libsync-mysql-lancetyrone86-8cd3.a.aivencloud.com    Database: libsync_db
-- ------------------------------------------------------
-- Server version	8.4.11

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `libsync_db`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `libsync_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `libsync_db`;

--
-- Table structure for table `admins`
--

DROP TABLE IF EXISTS `admins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `fk_admin_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admins`
--

LOCK TABLES `admins` WRITE;
/*!40000 ALTER TABLE `admins` DISABLE KEYS */;
INSERT INTO `admins` VALUES (1,2);
/*!40000 ALTER TABLE `admins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint DEFAULT NULL,
  `user_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_role` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outcome` varchar(12) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SUCCESS',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_created_at` (`created_at`),
  KEY `idx_audit_user_id` (`user_id`),
  KEY `idx_audit_action` (`action`),
  KEY `idx_audit_module` (`module`),
  KEY `idx_audit_role` (`user_role`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,2,'LibSync Admin','admin','LOGIN','Authentication','User signed in successfully.',NULL,'SUCCESS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-15 16:42:42'),(2,2,'LibSync Admin','admin','LOGOUT','Authentication','User signed out of LibSync.',NULL,'SUCCESS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-15 16:44:45'),(3,2,'LibSync Admin','admin','LOGOUT','Authentication','User signed out of LibSync.',NULL,'SUCCESS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-15 16:44:52'),(4,2,'LibSync Admin','admin','LOGOUT','Authentication','User signed out of LibSync.',NULL,'SUCCESS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-15 16:44:59'),(5,2,'LibSync Admin','admin','LOGIN','Authentication','User signed in successfully.',NULL,'SUCCESS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-15 16:45:14'),(6,2,'LibSync Admin','admin','LOGOUT','Authentication','User signed out of LibSync.',NULL,'SUCCESS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-15 16:45:48'),(7,2,'LibSync Admin','admin','LOGOUT','Authentication','User signed out of LibSync.',NULL,'SUCCESS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-15 16:46:01'),(8,2,'LibSync Admin','admin','LOGOUT','Authentication','User signed out of LibSync.',NULL,'SUCCESS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-15 16:46:09'),(9,2,'LibSync Admin','admin','LOGOUT','Authentication','User signed out of LibSync.',NULL,'SUCCESS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-15 16:46:16'),(10,2,'LibSync Admin','admin','LOGOUT','Authentication','User signed out of LibSync.',NULL,'SUCCESS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-15 16:46:23'),(11,2,'LibSync Admin','admin','LOGOUT','Authentication','User signed out of LibSync.',NULL,'SUCCESS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-15 16:46:30'),(12,2,'LibSync Admin','admin','LOGOUT','Authentication','User signed out of LibSync.',NULL,'SUCCESS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-15 16:46:38'),(13,2,'LibSync Admin','admin','LOGIN','Authentication','User signed in successfully.',NULL,'SUCCESS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-15 16:47:06'),(14,2,'LibSync Admin','admin','LOGIN','Authentication','User signed in successfully.',NULL,'SUCCESS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-15 16:47:14'),(15,12,'Rejoyce Matic-an','student','LOGIN','Authentication','User signed in successfully.',NULL,'SUCCESS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-15 16:49:06'),(16,12,'Rejoyce Matic-an','student','LOGOUT','Authentication','User signed out of LibSync.',NULL,'SUCCESS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-15 16:50:42'),(17,1,'Librarian','librarian','LOGIN','Authentication','User signed in successfully.',NULL,'SUCCESS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-15 16:56:41'),(18,2,'LibSync Admin','admin','LOGIN','Authentication','User signed in successfully.',NULL,'SUCCESS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36','2026-11-16 03:25:18');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `books`
--

DROP TABLE IF EXISTS `books`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `books` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `author` varchar(150) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `isbn` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `category` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `publisher` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `year_published` year DEFAULT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `available_quantity` int NOT NULL DEFAULT '1',
  `status` enum('available','borrowed','unavailable') COLLATE utf8mb4_general_ci DEFAULT 'available',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `isbn` (`isbn`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `books`
--

LOCK TABLES `books` WRITE;
/*!40000 ALTER TABLE `books` DISABLE KEYS */;
INSERT INTO `books` VALUES (1,'Introduction to Information Technology','Sample Author',NULL,'9781234567890','Information Technology','Sample Publisher',2025,5,1,'available','2026-08-25 12:26:05'),(2,'Hello Love GoodBye','qwerty',NULL,'1234567890','Drama/Romance','Nycs',2026,1,0,'unavailable','2026-08-25 12:47:33'),(3,'The C Programming Language','Brian W. Kernighan, Dennis MacAlistair Ritchie','Very well known, classic introduction to the C Programming Language. Both a text for learning, a reference, and, to some, the definition of proper C language features and use.','9782225800689','Programming','Prentice Hall',1978,1,1,'available','2026-10-15 11:02:02'),(4,'Aplikasi Analisis Multivariate Dengan Program IBM SPSS 25 (9th ed)','Imam ghozali, 2018','Applied Multivariate Analysis Using SPSS by Imam Ghozali introduces readers to statistical techniques for analyzing multiple variables using SPSS software. The book discusses various multivariate analysis methods, including regression analysis, factor analysis, discriminant analysis, and other statistical techniques used in research. It provides practical guidance on processing, interpreting, and analyzing complex datasets to support accurate research findings and informed decision-making.','9789797040154','Programming','Badan Penerbit Universitas Diponegoro',2018,1,0,'unavailable','2026-10-15 11:02:02'),(5,'The C++ programming language','Bjarne Stroustrup','The C++ Programming tome, written by the father of C++ himself, Bjarne Stroustrup.  The premier book on the subject of C++ Programming.','9780201700732','Programming','Addison-Wesley Professional',1986,1,1,'available','2026-10-15 11:02:02'),(6,'Object-oriented Programming with C++','E. Balagurusamy',NULL,'9780074620380','Programming','Tata McGraw Hill Education Private Limited',1997,1,1,'available','2026-10-15 11:02:02'),(7,'Information technology','Geoffrey Knott, Nick Waites',NULL,'9781901888010','Information Technology','Business Education Publishers Ltd',1995,1,1,'available','2026-10-15 11:02:02'),(8,'Information Technology Project Management','Kathy Schwalbe',NULL,'9780760011805','Information Technology','Course Technology',1999,1,1,'available','2026-10-15 11:02:02'),(9,'Management information systems','James A. O\'Brien','Note on front cover- \"This International Student Edition is for use outside of the U.S.\" Attached to inside back cover is one \"MISource 2007\" CD from \"Triad Interactive\" stating requirements as Windows 98, 2000, or XP.','9780256173543','Information Technology','McGraw Hill-Irwin',1990,1,1,'available','2026-10-15 11:02:02'),(10,'Introduction to Information Technology','Efraim Turban, Rex Kelly Rainer, Richard E. Potter',NULL,'9780471433095','Information Technology','Wiley',2005,1,1,'available','2026-10-15 11:02:02'),(11,'Chemistry','Theodore L. Brown, H. Eugene Lemay, Bruce E. Bursten, Catherine Murphy, Patrick Woodward, Catherine J. Murphy, James C. Hill, Theodore E Brown, Julia ','The book provides the basis of modern chemistry that every student needs for their professional development and as preparation for more complex chemistry courses. It also offers features that facilitate learning and serve as a guide for students to acquire a conceptual understanding and the skills needed to solve problems. The first five chapters offer a microscopic and phenomenological view of chemistry, while the latter review the chemistry of nonmetals, metals, organic chemistry and biochemistry.','9781292021522','Science','Pearson Higher Education & Professional Group',1977,1,1,'available','2026-10-15 11:02:02'),(12,'The science of getting rich, or, financial success through creative thought','Wallace D. Wattles, Ruth L Miller, Patricia J. Crane, Rick Nichols','As featured in the bestselling book The Secret, here is the landmark guide to wealth creation republished with the classic essay How to Get What You Want.Wallace D. Wattles spent a lifetime considering the laws of success as he found them in the work of the worlds great philosophers. He then turned his life effort into this simple, slender book  a volume that he vowed could replace libraries of philosophy, spirituality, and self-help for the purpose of attaining one definite goal: a life of prosperity.Wattles describes a definite science of wealth attraction, built on the foundation of one commanding idea: There is a thinking stuff from which all things are madeA thought, in this substance, produces the thing that is imaged by the thought.In his seventeen short, straight-to-the-point chapters, Wattles shows how to use this idea, how to overcome barriers to its application, and how work with very direct methods that awaken it in your life. He further explains how creation and not competition is the hidden key to wealth attraction, and how your power to get rich uplifts everyone around you.The Science of Getting Rich concludes with Wattles rare essay How to Get Want You Want  a brilliant refresher of his laws of wealth creation.','9789562911375','Science','Spastic Cat Press',1910,1,1,'available','2026-10-15 11:02:02'),(13,'Chaos','James Gleick','The author describes how scientists studying the growth of complexity in nature are discovering order and pattern in chaos. He explains concepts such as nonlinearity, the Butterfly Effect, universal constants, fractals, and strange attractors, and examines the work of scientists such as Mitchell J. Feigenbaum, Edward Lorenz, and Benoit Mandelbrot.','9789518840124','Science','Sphere Books',1987,1,0,'unavailable','2026-10-15 11:02:02'),(14,'Fundamentals Of Electricity And Magnetism','McGraw-Hill',NULL,'9780078671692','Science','Glencoe/McGraw-Hill',2001,2,2,'available','2026-10-15 11:02:02'),(15,'Heinemann Mathematics','Scottish Primary Mathematics Group','Heinemann Mathematics by the Scottish Primary Mathematics Group is an educational textbook designed to develop students\' mathematical understanding and problem-solving abilities. It covers essential mathematical concepts through structured lessons, practical examples, and exercises. The book helps learners strengthen their numerical skills, logical thinking, and confidence in applying mathematics to everyday situations.','9780435038175','Mathematics','Heinemann Educational',1983,1,1,'available','2026-10-15 11:02:02'),(16,'Advanced Engineering Mathematics','Erwin Kreyszig','Cited thousands of times in the scholarly literature, this is a seminal work in Engineering Mathematics. First published in 1962, the 2011 tenth edition of Advanced Engineering Mathematics is currently available. The Wikipedia article on the author states it is \"the leading textbook for civil, mechanical, electrical, and chemical engineering undergraduate engineering mathematics.\"\r\nPart of an Open Library list of Classic Engineering Books http://dld.bz/EngClassicsOL','9780471889410','Mathematics','Wiley',1957,1,0,'unavailable','2026-10-15 11:02:02'),(17,'Discrete Mathematics with Applications','Susanna S. Epp, Susanna Epp','Discrete Mathematics and Its Applications by Kenneth H. Rosen provides a comprehensive introduction to the fundamental concepts of discrete mathematics. It covers essential topics such as logic, set theory, algorithms, number theory, combinatorics, graph theory, and Boolean algebra. The book combines theoretical explanations with practical examples and problem-solving exercises, helping students develop logical reasoning, analytical thinking, and mathematical skills essential for computer science and information technology.','9781305292758','Mathematics','Cengage',1990,1,1,'available','2026-10-15 11:02:02'),(18,'Discrete Mathematics and Its Applications','Kenneth H. Rosen',NULL,'9781259676512','Mathematics','McGraw-Hill Higher Education',1988,1,1,'available','2026-10-15 11:02:02'),(19,'The Norton Anthology of English Literature','M. H. Abrams, M. Abrams, M. H. Adams, Stephen Greenblatt, Abrams, M. H., M. H. Abrams','The Norton Anthology of English Literature is a comprehensive collection of literary works from some of the most influential English writers throughout history. It features a wide range of poetry, prose, drama, and essays that reflect different literary periods, cultural movements, and historical experiences. This anthology provides readers with an opportunity to explore the development of English literature, appreciate classic masterpieces, and understand the ideas and creativity of renowned authors.','9780393948011','Literature','Norton & Company, Incorporated, W. W.',1962,1,1,'available','2026-10-15 11:02:02'),(20,'How to read literature like a professor','Thomas C. Foster','How to Read Literature Like a Professor by Thomas C. Foster explores the deeper meanings hidden in literary works. It teaches readers how to recognize symbols, themes, patterns, and references that authors use to communicate ideas beyond the surface of a story. Through engaging examples and practical explanations, the book helps readers develop critical thinking skills, understand literary techniques, and appreciate literature from a deeper perspective.','9780061259432','Literature','HarperCollins Publishers',2002,5,4,'available','2026-10-15 11:02:02');
/*!40000 ALTER TABLE `books` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `borrow_batches`
--

DROP TABLE IF EXISTS `borrow_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `borrow_batches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `borrow_qr_token` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `return_qr_token` char(36) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `borrow_qr_used_at` datetime DEFAULT NULL,
  `return_qr_used_at` datetime DEFAULT NULL,
  `status` varchar(30) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `requested_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `loan_days` tinyint unsigned NOT NULL DEFAULT '1',
  `due_date` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `qr_token` (`borrow_qr_token`),
  UNIQUE KEY `uq_borrow_batches_return_qr_token` (`return_qr_token`),
  KEY `fk_batch_user` (`user_id`),
  KEY `fk_batch_approved_by` (`approved_by`),
  CONSTRAINT `fk_batch_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_batch_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `borrow_batches`
--

LOCK TABLES `borrow_batches` WRITE;
/*!40000 ALTER TABLE `borrow_batches` DISABLE KEYS */;
INSERT INTO `borrow_batches` VALUES (7,4,'bf4aa194-c653-11f1-a82d-40c2baf17afa','9e4630c6-c888-11f1-be4e-40c2baf17afa',NULL,NULL,'approved','2026-10-12 15:29:44',5,'2026-10-15 00:40:32',1,NULL),(8,3,NULL,NULL,NULL,NULL,'declined','2026-10-12 16:47:57',5,'2026-10-15 13:40:02',1,NULL),(9,3,'cbbf3d26-d341-4ada-9ca9-cbd2b4a46d0e','9e463dc6-c888-11f1-be4e-40c2baf17afa',NULL,NULL,'approved','2026-10-15 05:40:42',5,'2026-10-15 13:51:21',1,NULL),(10,3,'9aa89d10-0430-4b3b-a779-3e7c4503d423','9e463efe-c888-11f1-be4e-40c2baf17afa',NULL,NULL,'approved','2026-10-15 06:37:00',5,'2026-10-15 18:39:32',1,NULL),(11,8,'d893e29c-3e83-406b-8323-4a65981fff10','fc1089ba-5709-410b-ab48-643904456477','2026-10-17 05:08:42','2026-10-17 05:15:25','returned','2026-10-17 04:04:16',5,'2026-10-17 04:22:02',1,'2026-10-18 05:08:42'),(12,8,'dd8e072f-f3c8-4794-b080-8222b49c1953','8e33cade-42ab-4802-b02d-20e50776a1a0','2026-10-17 08:57:42','2026-10-17 09:01:19','returned','2026-10-17 08:40:35',5,'2026-10-17 08:54:06',1,'2026-10-18 08:57:42'),(13,8,'f502ce5a-eb4c-485c-a089-348590a66db6','432635eb-ac9d-4a75-abde-e33f07f95723','2026-10-29 15:15:49','2026-11-11 12:02:44','returned','2026-10-29 15:10:50',5,'2026-10-29 15:12:11',1,'2026-10-30 15:15:49'),(14,8,'55d8fb23-cadf-440f-b925-1081dd4f8f0e','4478d70a-5cc8-44e9-bc49-1f8409040f50','2026-10-29 15:27:36','2026-10-29 15:30:16','returned','2026-10-29 15:24:38',5,'2026-10-29 15:25:24',1,'2026-10-30 15:27:36'),(15,9,'32ce5116-888c-4269-9ca1-3339321b9ee9','393dad6a-9080-4ac6-9310-13947b3f6fc3','2026-11-05 18:08:26','2026-11-05 18:14:29','returned','2026-11-04 09:38:30',1,'2026-11-04 09:56:43',1,'2026-11-06 18:08:26'),(16,10,'db5eadda-d79e-4312-aef3-150abe095aae','8e1c09f5-575d-46e9-8c50-d2a30c48793f','2026-11-04 13:43:01','2026-11-04 13:45:09','returned','2026-11-04 13:40:32',1,'2026-11-04 13:41:03',1,'2026-11-05 13:43:01'),(17,8,'40353f17-9457-4961-9ae8-65211db02c0b','aa47ad08-884e-40e7-96c3-b8ecbaa32435','2026-11-04 18:23:59','2026-11-04 18:26:53','returned','2026-11-04 18:12:02',5,'2026-11-04 18:18:56',1,'2026-11-05 18:23:59'),(18,9,'95a4865e-ba0f-4b3c-9e19-18d1f54d5444','2f1ae2b8-1444-4c0c-a21d-219d941fd477','2026-11-05 18:59:31','2026-11-05 19:02:46','returned','2026-11-05 18:55:45',1,'2026-11-05 18:58:01',1,'2026-11-06 18:59:31'),(19,12,'ec1c90dd-a752-4e54-8cef-74f8c22b88d4','8571e380-836e-42d6-b0aa-005d9c7232e6','2026-11-10 02:37:48','2026-11-11 10:14:24','returned','2026-11-10 02:29:39',1,'2026-11-10 02:32:58',1,'2026-11-11 00:00:00'),(20,12,'2cfd7368-d799-4d5b-9573-3cc733b976e1','21116d16-c729-4e7b-9ed7-8d8fd2627f63','2026-11-10 03:33:59','2026-11-10 03:36:54','returned','2026-11-10 03:29:46',1,'2026-11-10 03:31:58',1,'2026-11-11 00:00:00'),(21,9,'36db55e0-98b6-48fd-a370-cdeb11a775f3','a4d3cedb-f917-49e0-9298-ed8efb6f805f','2026-11-11 18:09:09',NULL,'approved','2026-11-10 06:54:09',1,'2026-11-10 06:55:13',1,'2026-11-12 18:09:09'),(22,8,'ee3ecbff-cd83-464e-8da0-78affa0cdba3','85996228-e596-423e-a83e-9dbb5d932651','2026-11-11 08:39:19','2026-11-11 11:59:39','returned','2026-11-11 08:08:16',1,'2026-11-11 08:08:49',1,'2026-11-12 08:39:19'),(23,8,NULL,NULL,NULL,NULL,'declined','2026-11-11 11:56:56',1,'2026-11-11 11:57:50',1,NULL),(24,12,NULL,NULL,NULL,NULL,'declined','2026-11-11 12:40:51',1,'2026-11-11 12:42:11',1,NULL),(25,12,'ae319605-133e-4396-b08a-432851850f59','57826d40-f3f6-4b4b-a5de-ac948dc59d36','2026-11-11 14:48:40','2026-11-11 18:44:53','returned','2026-11-11 13:02:27',1,'2026-11-11 13:03:59',1,'2026-11-12 14:48:40'),(26,12,'80de65b9-eb59-435f-8d5e-e41787b1dc72','a55f937c-207b-4f1f-9c6b-636f4cd240b8','2026-11-11 16:58:53','2026-11-15 13:08:10','returned','2026-11-11 14:53:50',1,'2026-11-11 16:22:49',1,'2026-11-12 16:58:53'),(27,9,NULL,NULL,NULL,NULL,'declined','2026-11-11 18:30:20',1,'2026-11-11 18:35:00',1,NULL),(28,8,'15cd55d0-d1b6-48e1-a47c-f4aa1c679048','f33e4934-9cf3-45aa-892c-2017496d1c47','2026-11-12 12:15:42','2026-11-12 12:17:29','returned','2026-11-12 04:21:53',1,'2026-11-12 04:23:59',1,'2026-11-13 12:15:42'),(29,8,'e9c35a0e-70ee-4cea-b221-5033543aebee','1c112da1-ec66-4ef7-9cfa-929b5cd3fe6c','2026-11-12 12:21:08','2026-11-12 12:22:57','returned','2026-11-12 12:19:24',5,'2026-11-12 12:19:58',1,'2026-11-13 12:21:08'),(30,8,'47528e1c-89af-4e47-b8da-193ace669bc6','2d4b76f0-0275-46a8-b6d0-f58b4b30faa8','2026-11-12 15:44:12','2026-11-12 15:46:16','returned','2026-11-12 15:29:56',5,'2026-11-12 15:31:48',1,'2026-11-13 15:44:12'),(31,8,'e6c46be2-df61-49a8-b085-cfac71dbb087','c4c339c7-3a63-4a34-b145-984695660a75','2026-11-12 16:07:00','2026-11-12 17:16:13','returned','2026-11-12 16:04:17',5,'2026-11-12 16:05:06',1,'2026-11-13 16:07:00'),(32,8,NULL,NULL,NULL,NULL,'declined','2026-11-12 17:12:08',5,'2026-11-12 17:14:05',1,NULL),(33,9,'2036d47f-d8f3-4148-b563-a268d1b80db9',NULL,'2026-11-13 03:37:41',NULL,'approved','2026-11-13 03:27:47',1,'2026-11-13 03:30:17',1,'2026-11-14 03:37:41'),(34,8,'a4abc53c-932d-4b66-8cae-84cb86238738','27ef1aed-3447-4c47-90bc-030dce4282c7','2026-11-13 08:01:53',NULL,'approved','2026-11-13 07:56:27',1,'2026-11-13 07:59:12',1,'2026-11-14 08:01:53'),(35,8,'8825c3d2-fc1b-426c-9cbe-3e8c1f3e1f22','095c70ac-bb3b-4727-8fd8-46d688158583','2026-11-13 08:06:24',NULL,'approved','2026-11-13 08:02:58',1,'2026-11-13 08:03:49',1,'2026-11-14 08:06:24');
/*!40000 ALTER TABLE `borrow_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `borrow_requests`
--

DROP TABLE IF EXISTS `borrow_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `borrow_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `batch_id` int DEFAULT NULL,
  `user_id` int NOT NULL,
  `book_id` int NOT NULL,
  `requested_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('pending','approved','declined') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `qr_token` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `returned_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `qr_token` (`qr_token`),
  KEY `fk_request_user` (`user_id`),
  KEY `fk_request_book` (`book_id`),
  KEY `fk_request_admin` (`approved_by`),
  KEY `idx_borrow_requests_batch_id` (`batch_id`),
  CONSTRAINT `fk_borrow_requests_batch` FOREIGN KEY (`batch_id`) REFERENCES `borrow_batches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_request_admin` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_request_book` FOREIGN KEY (`book_id`) REFERENCES `books` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_request_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `borrow_requests`
--

LOCK TABLES `borrow_requests` WRITE;
/*!40000 ALTER TABLE `borrow_requests` DISABLE KEYS */;
INSERT INTO `borrow_requests` VALUES (1,NULL,1,1,'2026-08-26 12:50:19','approved',2,'2026-08-26 12:55:27','db7e9cdc-7e18-4235-93bf-407d6d709fa7',NULL),(2,NULL,1,1,'2026-08-27 13:12:15','declined',5,'2026-09-07 12:07:59',NULL,NULL),(3,NULL,3,1,'2026-08-28 02:23:11','approved',2,'2026-08-28 02:25:30','5eb4ad58-3353-42e2-8d9a-e0e121300218',NULL),(4,7,4,2,'2026-10-12 15:29:44','approved',5,'2026-10-14 16:40:32',NULL,NULL),(5,7,4,1,'2026-10-12 15:29:44','approved',5,'2026-10-14 16:40:30',NULL,NULL),(6,8,3,1,'2026-10-12 16:47:57','declined',5,'2026-10-15 05:39:52',NULL,NULL),(7,8,3,2,'2026-10-12 16:47:57','declined',5,'2026-10-15 05:40:02',NULL,NULL),(8,9,3,1,'2026-10-15 05:40:42','approved',5,'2026-10-15 05:51:21',NULL,NULL),(9,10,3,1,'2026-10-15 06:37:00','approved',5,'2026-10-15 10:39:32',NULL,NULL),(10,11,8,16,'2026-10-17 04:04:17','approved',5,'2026-10-17 04:21:20',NULL,'2026-10-17 05:15:24'),(11,11,8,4,'2026-10-17 04:04:17','approved',5,'2026-10-17 04:22:02',NULL,'2026-10-17 05:15:25'),(12,12,8,17,'2026-10-17 08:40:35','declined',5,'2026-10-17 08:54:05',NULL,NULL),(13,12,8,18,'2026-10-17 08:40:35','declined',5,'2026-10-17 08:53:30',NULL,NULL),(14,12,8,11,'2026-10-17 08:40:35','approved',5,'2026-10-17 08:53:03',NULL,'2026-10-17 09:01:18'),(15,13,8,20,'2026-10-29 15:10:50','approved',5,'2026-10-29 15:12:10',NULL,'2026-11-11 12:02:44'),(16,14,8,6,'2026-10-29 15:24:38','approved',5,'2026-10-29 15:25:23',NULL,'2026-10-29 15:30:15'),(17,15,9,18,'2026-11-04 09:38:30','approved',1,'2026-11-04 09:56:42',NULL,'2026-11-05 18:14:28'),(18,16,10,16,'2026-11-04 13:40:32','approved',1,'2026-11-04 13:41:02',NULL,'2026-11-04 13:45:09'),(19,17,8,13,'2026-11-04 18:12:03','approved',5,'2026-11-04 18:18:56',NULL,'2026-11-04 18:26:52'),(20,18,9,16,'2026-11-05 18:55:45','approved',1,'2026-11-05 18:57:41',NULL,'2026-11-05 19:02:45'),(21,18,9,15,'2026-11-05 18:55:45','approved',1,'2026-11-05 18:58:01',NULL,'2026-11-05 19:02:45'),(22,19,12,16,'2026-11-10 02:29:39','approved',1,'2026-11-10 02:32:57',NULL,'2026-11-11 10:14:23'),(23,19,12,4,'2026-11-10 02:29:39','approved',1,'2026-11-10 02:32:38',NULL,'2026-11-11 10:14:24'),(24,20,12,13,'2026-11-10 03:29:47','approved',1,'2026-11-10 03:31:57',NULL,'2026-11-10 03:36:53'),(25,21,9,20,'2026-11-10 06:54:09','approved',1,'2026-11-10 06:55:13',NULL,NULL),(26,22,8,13,'2026-11-11 08:08:17','approved',1,'2026-11-11 08:08:49',NULL,'2026-11-11 11:59:38'),(27,23,8,16,'2026-11-11 11:56:56','declined',1,'2026-11-11 11:57:50',NULL,NULL),(28,24,12,18,'2026-11-11 12:40:51','declined',1,'2026-11-11 12:42:11',NULL,NULL),(29,25,12,1,'2026-11-11 13:02:28','approved',1,'2026-11-11 13:03:58',NULL,'2026-11-11 18:44:53'),(30,26,12,14,'2026-11-11 14:53:50','approved',1,'2026-11-11 16:22:48',NULL,'2026-11-15 13:08:09'),(31,27,9,16,'2026-11-11 18:30:20','declined',1,'2026-11-11 18:34:59',NULL,NULL),(32,28,8,4,'2026-11-12 04:21:53','approved',1,'2026-11-12 04:23:58',NULL,'2026-11-12 12:17:28'),(33,29,8,20,'2026-11-12 12:19:24','approved',5,'2026-11-12 12:19:58',NULL,'2026-11-12 12:22:57'),(34,30,8,6,'2026-11-12 15:29:56','approved',5,'2026-11-12 15:31:48',NULL,'2026-11-12 15:46:15'),(35,31,8,19,'2026-11-12 16:04:17','approved',5,'2026-11-12 16:05:05',NULL,'2026-11-12 17:16:13'),(36,32,8,16,'2026-11-12 17:12:09','declined',5,'2026-11-12 17:14:05',NULL,NULL),(37,33,9,16,'2026-11-13 03:27:47','approved',1,'2026-11-13 03:30:17',NULL,NULL),(38,34,8,4,'2026-11-13 07:56:27','approved',1,'2026-11-13 07:59:12',NULL,NULL),(39,35,8,13,'2026-11-13 08:02:58','approved',1,'2026-11-13 08:03:48',NULL,NULL);
/*!40000 ALTER TABLE `borrow_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `borrowings`
--

DROP TABLE IF EXISTS `borrowings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `borrowings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `book_id` int NOT NULL,
  `borrowed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `due_date` date NOT NULL,
  `returned_at` timestamp NULL DEFAULT NULL,
  `status` enum('borrowed','returned','overdue') COLLATE utf8mb4_general_ci DEFAULT 'borrowed',
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `book_id` (`book_id`),
  CONSTRAINT `borrowings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `borrowings_ibfk_2` FOREIGN KEY (`book_id`) REFERENCES `books` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `borrowings`
--

LOCK TABLES `borrowings` WRITE;
/*!40000 ALTER TABLE `borrowings` DISABLE KEYS */;
INSERT INTO `borrowings` VALUES (1,1,1,'2026-08-25 12:29:51','2026-09-01','2026-08-25 12:31:32','returned'),(2,1,1,'2026-08-26 12:55:27','2026-09-02',NULL,'borrowed'),(3,3,1,'2026-08-28 02:25:30','2026-09-04','2026-08-29 12:58:56','returned');
/*!40000 ALTER TABLE `borrowings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `librarian_qr_scan_events`
--

DROP TABLE IF EXISTS `librarian_qr_scan_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `librarian_qr_scan_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `batch_id` int NOT NULL,
  `librarian_id` int NOT NULL,
  `qr_type` varchar(12) NOT NULL,
  `scanned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_scan_batch` (`batch_id`,`scanned_at`),
  KEY `idx_scan_time` (`scanned_at`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `librarian_qr_scan_events`
--

LOCK TABLES `librarian_qr_scan_events` WRITE;
/*!40000 ALTER TABLE `librarian_qr_scan_events` DISABLE KEYS */;
INSERT INTO `librarian_qr_scan_events` VALUES (1,31,5,'borrow','2026-11-12 16:06:04'),(2,31,5,'return','2026-11-12 17:15:58'),(3,31,5,'return','2026-11-12 17:16:21'),(4,33,1,'borrow','2026-11-13 03:36:57'),(5,34,1,'borrow','2026-11-13 08:00:37'),(6,34,1,'borrow','2026-11-13 08:02:02'),(7,35,1,'borrow','2026-11-13 08:05:31'),(8,26,1,'return','2026-11-15 13:00:48'),(9,26,1,'return','2026-11-15 13:07:38'),(10,26,1,'return','2026-11-15 13:08:18');
/*!40000 ALTER TABLE `librarian_qr_scan_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `librarian_release_resolutions`
--

DROP TABLE IF EXISTS `librarian_release_resolutions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `librarian_release_resolutions` (
  `batch_id` int NOT NULL,
  `disposition` varchar(24) NOT NULL,
  `resolved_by` int NOT NULL,
  `resolved_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actual_handover_at` datetime DEFAULT NULL,
  `note` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `librarian_release_resolutions`
--

LOCK TABLES `librarian_release_resolutions` WRITE;
/*!40000 ALTER TABLE `librarian_release_resolutions` DISABLE KEYS */;
INSERT INTO `librarian_release_resolutions` VALUES (31,'handed_over',5,'2026-11-12 16:09:10','2026-11-12 16:07:00','test'),(33,'handed_over',1,'2026-11-13 03:37:44','2026-11-13 03:37:41','Librarian confirmed physical handover using Save Resolution; release time recorded at confirmation.'),(35,'handed_over',1,'2026-11-13 08:06:28','2026-11-13 08:06:24','Librarian confirmed physical handover using Save Resolution; release time recorded at confirmation.');
/*!40000 ALTER TABLE `librarian_release_resolutions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `librarians`
--

DROP TABLE IF EXISTS `librarians`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `librarians` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `fk_librarian_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `librarians`
--

LOCK TABLES `librarians` WRITE;
/*!40000 ALTER TABLE `librarians` DISABLE KEYS */;
INSERT INTO `librarians` VALUES (1,1),(2,5),(5,7);
/*!40000 ALTER TABLE `librarians` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `role_name` (`role_name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'admin'),(2,'librarian'),(3,'student');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `students`
--

DROP TABLE IF EXISTS `students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `students` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `student_number` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `program` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `college` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `year_level` tinyint unsigned DEFAULT NULL,
  `gender` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  UNIQUE KEY `student_number` (`student_number`),
  CONSTRAINT `fk_student_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `students`
--

LOCK TABLES `students` WRITE;
/*!40000 ALTER TABLE `students` DISABLE KEYS */;
INSERT INTO `students` VALUES (1,3,'21-2011','BSIS','CCSICT',5,'Female'),(2,4,'20-2062','BSIT','CCSICT',4,'Male'),(3,6,'24-2005','BSCS','CCSICT',1,'Male'),(9,8,'12-3456','bsit','ccsict',3,'male'),(10,9,'24-2038','BSIT','CCSICT',3,'Male'),(11,10,'24-2055','BSIT','CCSICT',3,'Female'),(12,11,'24-2021','BSIT','CCSICT',1,'Female'),(15,12,'24-2062','BSIT','CCSICT',3,'Female');
/*!40000 ALTER TABLE `students` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `role` enum('admin','librarian','student') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'student',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `role_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_users_role` (`role_id`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Librarian','librarian@libsync.com','scrypt:32768:8:1$3jUMLVAQqZJ0Zwrp$f72b465d3dea92fd2408655fdfa9d2a274b32e894ea6338fecd411ab0922caf255032120b64ff79f4c721b5fd231cf25e95ee17450915f8080594a4576f195b0','librarian','2026-08-25 12:20:49',2),(2,'LibSync Admin','admin@libsync.com','scrypt:32768:8:1$74FGm60CNH31cYoV$bddec535be4a3c8e30b21a26635eba17543e7046ed9ba1e91bed2091255841aca6f29d789de101eea0962d4e150326a6dd0a1c8afc4cd40b70b67bd06b581bc1','admin','2026-08-26 12:55:04',1),(3,'Test Student','student@libsync.com','scrypt:32768:8:1$xcJS8SpdR62ckSdg$91d8ec1542ec0d5f005ded5d6225b5517f2122284f8ff7a2188523315a50c65c98f5bf4b883964474ab94ac5100e3725ef69aab4c8c457aa9274fca25d83aa01','student','2026-08-28 02:08:43',3),(4,'Tohru Pot','tohru@gmail.com','TohruPot123','student','2026-09-01 03:43:24',3),(5,'Ana Cruz','anacruz@gmail.com','scrypt:32768:8:1$1xtP3ngF1fhF1p9I$f91ebf7e8acf3cf92c5967abe11715d1efb06dca6dbe5bf27021dcc78c54b2440ac23d586069b2a028b6558d0d5a19c90fdcb34b78b6be54ce77a6a06ea7a48e','librarian','2026-09-01 06:00:10',2),(6,'Moniko','moniko@gmail.com','moniko12345','student','2026-09-01 12:57:11',3),(7,'Rejoyce Matic-an','joyce07@isu.edu.ph','qwerty123','librarian','2026-09-06 12:28:50',2),(8,'lance test account','lancetyrone76@gmail.com','scrypt:32768:8:1$pJhqYMtqIBhI03gW$118c1e6c249b53214e8e40286d3baef195df6d0c9dd240fe7558edf3e6ad6e979c2cd879104f3f8094a14279d836987cff1bf6ccf4b9412078af604dfd067d7d','student','2026-10-17 03:28:18',3),(9,'IJ Dumaguing','student01@gmail.com','scrypt:32768:8:1$agEbeXch2kiyjmkz$58c1a29bea3c59737ae074ea4553f799162a86e51e3cb4f9fe9cfee01b92222cbc9ed42c0f53e8c5ae1849277148fd685f9b90bd540b24acb5241390d80459ca','student','2026-11-04 05:48:29',3),(10,'Maureen Layco','maureen@gmail.com','scrypt:32768:8:1$xoKlxjUMGMdCSJtQ$45617924bfc2e6ebd387d600177b4796f95b5ae65fbfd0c2ac62be7cbd70e70d27c501393212c132aed8abc6bdb249609a8b9fba4c599c2d1ad7bf49feea70d1','student','2026-11-04 12:38:59',3),(11,'Anabelle Reyes','anabelle@gmail.com','scrypt:32768:8:1$aOPvT9jNglO9s5Fu$f8fb28bbb55f5070d0d200885c29476a491c07834fb63ba89c85b2c7c7ae82cf271a260dfb48cf8ae78668134211b58413c6c3b5a7c84c20e8846e519538fe32','student','2026-11-09 11:01:03',3),(12,'Rejoyce Matic-an','rejoyce@gmail.com','scrypt:32768:8:1$I3Be8NH7RxizP9K5$f57b4ae0cd46db72bb09e2865208a8815d2fdbf4d6909bc2001257105ce9d5bbbd10341826a36b86c06de3cdfbcab74c3e5a22f497498ee2d47c385e516106ff','student','2026-11-10 01:14:03',3);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'libsync_db'
--

--
-- Dumping routines for database 'libsync_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-16 13:02:04
