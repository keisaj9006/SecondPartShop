<?php
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

// Pobranie aktualnej nazwy pliku (np. 'index.php')
$current_page = basename($_SERVER['PHP_SELF']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SecondPart</title>
    <link rel="stylesheet" href="style.css">
    <style>
        nav {
            background-color: #333;
            padding: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        nav a {
            color: white;
            text-decoration: none;
            margin: 0 15px;
            font-size: 18px;
            padding: 10px;
        }
        nav a:hover {
            background-color: #575757;
            border-radius: 5px;
        }
        .active {
            background-color: #007BFF; /* Podkreślenie aktywnej strony */
            border-radius: 5px;
        }
        .nav-links {
            display: flex;
            align-items: center;
        }
    </style>
</head>
<body>

<nav>
    <div class="nav-links">
        <a href="index.php" class="<?= ($current_page == 'index.php') ? 'active' : '' ?>">Home</a>
        <a href="search.php" class="<?= ($current_page == 'search.php') ? 'active' : '' ?>">Search</a>
        <a href="cart.php" class="<?= ($current_page == 'cart.php') ? 'active' : '' ?>">Cart</a>
        <a href="checkout.php" class="<?= ($current_page == 'checkout.php') ? 'active' : '' ?>">Checkout</a>
        <a href="order_status.php" class="<?= ($current_page == 'order_status.php') ? 'active' : '' ?>">Orders</a>
    </div>

    <div class="nav-links">
        <?php if (isset($_SESSION['user_id'])): ?>
            <a href="dashboard.php" class="<?= ($current_page == 'dashboard.php') ? 'active' : '' ?>">Dashboard</a>
            <a href="logout.php">Logout</a>
        <?php else: ?>
            <a href="register.php" class="<?= ($current_page == 'register.php') ? 'active' : '' ?>">Register</a>
            <a href="login.php" class="<?= ($current_page == 'login.php') ? 'active' : '' ?>">Login</a>
        <?php endif; ?>
    </div>
</nav>

</body>
</html>
