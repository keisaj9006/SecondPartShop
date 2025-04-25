<?php
include 'db.php';
session_start();
include 'nav.php'; // Usunięta błędna składnia

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $email = $_POST['email'];
    $password = $_POST['password'];

    $sql = "SELECT * FROM users WHERE email='$email'";
    $result = $conn->query($sql);
    $user = $result->fetch_assoc();

    if (password_verify($password, $user['password'])) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['role'] = $user['role'];
        header("Location: dashboard.php");
    } else {
        echo "Invalid login credentials";
    }
}
?>
<!DOCTYPE html>
<html>
<head>
    <title>Login - SecondPart</title>
</head>
<body>
    <h2>Login</h2>
    <form method="POST">
        <input type="email" name="email" placeholder="Email" required>
        <input type="password" name="password" placeholder="Password" required>
        <button type="submit">Login</button>
    </form>
</body>
</html>
