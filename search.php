<?php
include 'db.php';
include 'nav.php'; // Usunięta błędna składnia


if (isset($_GET['query'])) {
    $query = $_GET['query'];
    $sql = "SELECT * FROM parts WHERE name LIKE '%$query%' OR category LIKE '%$query%'";
    $result = $conn->query($sql);

    echo "<h2>Search Results</h2>";
    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            echo "<p>{$row['name']} - {$row['category']} - £{$row['price']}</p>";
        }
    } else {
        echo "<p>No results found.</p>";
    }
}
?>
