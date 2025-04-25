# SecondPart (In Progress)

SecondPart is an open-source PHP-based web platform designed for buying and selling used car and motorcycle parts in the UK. It aims to connect individual buyers with verified garage sellers via a simple, responsive, and intuitive marketplace.

🚧 **This project is still in development. Many features are actively being added and refined.**

## 🔧 Technologies Used

- PHP (vanilla, procedural + prepared statements)
- MySQL (MariaDB)
- Bootstrap 4.6 (via CDN)
- HTML5, CSS3, JavaScript
- Session-based authentication (with roles: buyer, seller)
- PayPal & Stripe integration (in progress)
- XAMPP (for local development)

## 📁 Project Structure

```
/SecondPart
|
|├— add_part.php         # Seller's interface to add parts
|├— cart.php             # Shopping cart logic
|├— checkout.php         # Order confirmation and payment
|├— db.php               # Database connection
|├— footer.php           # Page footer
|├— index.php            # Home page with search
|├— login.php / logout.php
|├— nav.php              # Navigation bar with role logic
|├— order_status.php     # Track past orders
|├— payment.php / process_payment.php
|├— read.php             # Product listing for admin/seller
|├— register.php         # Account creation (with buyer/seller choice)
|├— search.php           # Part search engine
|└— style.css            # Basic design and layout styling
```

## 🚀 Getting Started Locally

1. Clone this repository:
```bash
git clone https://github.com/yourusername/SecondPart.git
```

2. Start XAMPP and enable **Apache** & **MySQL**

3. Import the SQL database:
- Go to [http://localhost/phpmyadmin](http://localhost/phpmyadmin)
- Create a new database called `secondpart`
- Import the `database.sql` file provided

4. Place the project in `htdocs`:
```bash
mv SecondPart /path/to/xampp/htdocs/
```

5. Open your browser and go to:
```bash
http://localhost/SecondPart/
```

## 🔫 Current Features

- ✅ Buyer/seller registration & login
- ✅ Seller dashboard with product management (add/edit/delete)
- ✅ Product search by name or category
- ✅ Shopping cart and checkout process
- ✅ Order history
- ✅ Navigation based on user role
- ✅ Session management and basic validation

## 📋 Upcoming Features (To Do)

- [ ] Wishlist page (for logged-in buyers)
- [ ] Blog page (dynamic or static articles)
- [ ] Image upload system with secure validation
- [ ] Stripe/PayPal payment confirmation & validation
- [ ] Seller verification and profile management
- [ ] User reviews for sellers
- [ ] Responsive layout polishing

## 👥 Contributing

Pull requests are welcome! Please open an issue first to discuss what you would like to change.
