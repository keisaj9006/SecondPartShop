<?php
include 'db.php';
session_start();
include 'nav.php'; // Usunięta błędna składnia

if (!isset($_SESSION['user_id']) || $_SESSION['role'] != 'seller') {
    die("Access denied");
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $name = $_POST['name'];
    $category = $_POST['category'];
    $price = $_POST['price'];
    $seller_id = $_SESSION['user_id'];

    $sql = "INSERT INTO parts (name, category, price, seller_id) VALUES ('$name', '$category', '$price', '$seller_id')";
    if ($conn->query($sql) === TRUE) {
        echo "Part added successfully!";
    } else {
        echo "Error: " . $conn->error;
    }
}
?>
<!DOCTYPE html>
<html>
<head>
    <title>Add Part - SecondPart</title>
</head>
<body>
    <h2>Add a New Part</h2>
    <form method="POST">
        <input type="text" name="name" placeholder="Part Name" required>
        <input type="text" name="category" placeholder="Category" required>
        <input type="number" name="price" placeholder="Price" required>
        <button type="submit">Add Part</button>
    </form>
</body>
</html>
