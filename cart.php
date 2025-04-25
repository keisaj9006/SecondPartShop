<?php
session_start();
require('db.php');
include('nav.php');

$total = 0;
?>

<div class="container my-4">
    <h2 class="text-center mb-4">Shopping Cart</h2>

    <?php if (!empty($_SESSION['cart'])): ?>
        <form action="cart.php" method="post">
            <table class="table table-striped table-hover text-center">
                <thead class="thead-dark">
                    <tr>
                        <th>Product</th>
                        <th>Price</th>
                        <th>Quantity</th>
                        <th>Subtotal</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    <?php
                    foreach ($_SESSION['cart'] as $id => $item) {
                        $q = "SELECT item_name FROM products WHERE item_id = ?";
                        $stmt = $link->prepare($q);
                        $stmt->bind_param("i", $id);
                        $stmt->execute();
                        $result = $stmt->get_result();
                        $row = $result->fetch_assoc();

                        $subtotal = $item['quantity'] * $item['price'];
                        $total += $subtotal;
                    ?>
                        <tr>
                            <td><?= htmlspecialchars($row['item_name']); ?></td>
                            <td>£<?= number_format($item['price'], 2); ?></td>
                            <td>
                                <input type="number" name="qty[<?= $id; ?>]" value="<?= $item['quantity']; ?>" min="1" class="form-control w-50 mx-auto">
                            </td>
                            <td>£<?= number_format($subtotal, 2); ?></td>
                            <td>
                                <a href="remove.php?id=<?= $id; ?>" class="btn btn-danger btn-sm">Remove</a>
                            </td>
                        </tr>
                    <?php
                    }
                    ?>
                    <tr class="font-weight-bold">
                        <td colspan="3" class="text-right">Total</td>
                        <td>£<?= number_format($total, 2); ?></td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
            <div class="text-right">
                <input type="submit" name="update" value="Update Cart" class="btn btn-primary mr-2">
                <a href="checkout.php" class="btn btn-success">Checkout</a>
            </div>
        </form>
    <?php else: ?>
        <p class="text-center text-muted">Your cart is empty.</p>
    <?php endif; ?>
</div>JLIO

<?php
if ($_SERVER['REQUEST_METHOD'] == 'POST' && isset($_POST['qty'])) {
    foreach ($_POST['qty'] as $id => $quantity) {
        if ($quantity > 0) {
            $_SESSION['cart'][$id]['quantity'] = $quantity;
        } else {
            unset($_SESSION['cart'][$id]);
        }
    }
    header('Location: cart.php');
}
?>

