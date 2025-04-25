<?php
session_start(); // Sesja musi być otwarta na początku
include 'db.php';
include 'nav.php'; // Usunięta błędna składnia
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SecondPart - Search Used Parts</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>Search for Used Car & Motorcycle Parts</h1>
    <form method="GET" action="search.php">
        <input type="text" name="query" placeholder="Enter part name, brand, or category" required>
        <button type="submit">Search</button>
    </form>
</body>
</html>
