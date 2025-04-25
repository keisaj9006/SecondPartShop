<?php
session_start();
include 'nav.php'; // Usunięta błędna składnia
session_destroy();
header("Location: login.php");
exit;
?>
