# RC Mobiles & Services — GST Invoice & ERP Management System

A comprehensive, state-of-the-art POS Billing, Inventory, and Stock Management ERP software for **RC Mobiles** (Madakasira, Andhra Pradesh).

## 🚀 Key Features

- **POS Billing & Instant Invoicing**: Live interactive A4 & 3-inch thermal invoice generation with real-time tax calculation (GST 18% inclusive).
- **Mandatory Customer & Item Validation**: Field enforcement with customer verification tick, cash tally checking, and loan finance tracking (Bajaj Finserv, TVS, Home Credit, Samsung Finance+, etc.).
- **Live Inventory Catalog**: Real-time stock status, category filters (Smartphones, Chargers, Audio, Glass, Accessories), batch deletes, and brand-wise management.
- **Enterprise Security & Roles**: Multi-role user authentication (Super Admin, Manager, Cashier) and hardware-bound license activation system with lock screens.
- **Cloud Database (Supabase)**: Real-time PostgreSQL sync for invoices, invoice items, products, and store settings with automatic counter increments.
- **Data Export & Reporting**: One-click CSV and Excel export with comprehensive sales analytics.
- **Mobile Responsive Design**: Optimized interface for smartphones, tablets, and desktop workstations.

## 🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla JavaScript (ES6+), TailwindCSS, Material Symbols
- **Backend**: Python (Flask, Flask-CORS)
- **Database**: Supabase PostgreSQL + SQLite Local Store
- **Print Engine**: Pixel-perfect A4 Portrait & 3-inch Thermal Print CSS with print-safe sanitization

## 📦 Getting Started

1. **Install Dependencies**:
   `ash
   cd backend
   pip install -r requirements.txt
   `

2. **Run Server**:
   `ash
   python app.py
   `

3. **Open Application**:
   Open http://localhost:5000 or load rontend/index.html in your browser.
