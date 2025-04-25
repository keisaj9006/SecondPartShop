<?php
session_start();
include 'db.php';

if (!isset($_SESSION['user_id'])) {
    echo "<p>Please log in to proceed.</p>";
    exit();
}

$user_id = $_SESSION['user_id'];
$total = 0;

$sql = "SELECT item_id, quantity, price FROM cart WHERE user_id = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();

while ($row = $result->fetch_assoc()) {
    $total += $row['price'] * $row['quantity'];
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $insert_order = "INSERT INTO orders (user_id, total) VALUES (?, ?)";
    $stmt_order = $conn->prepare($insert_order);
    $stmt_order->bind_param("id", $user_id, $total);
    $stmt_order->execute();

    $order_id = $conn->insert_id;

    foreach ($_SESSION['cart'] as $id => $item) {
        $insert_contents = "INSERT INTO order_contents (order_id, item_id, quantity, price) VALUES (?, ?, ?, ?)";
        $stmt_content = $conn->prepare($insert_contents);
        $stmt_content->bind_param("iiid", $order_id, $id, $item['quantity'], $item['price']);
        $stmt_content->execute();
    }

    $_SESSION['cart'] = [];
    echo "<p>Order placed successfully! Your order number is $order_id.</p>";
}
?>
<form method="POST">
    <button type="submit">Confirm Purchase</button>
</form>
