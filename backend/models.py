from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class StoreSettings(db.Model):
    __tablename__ = 'store_settings'
    
    id = db.Column(db.Integer, primary_key=True)
    store_name = db.Column(db.String(150), default="RC Mobiles")
    address = db.Column(db.Text, default="NTR Circle, Madakasira, Ananthapur (Sri Sathya Sai district region), Andhra Pradesh 515301")
    gstin = db.Column(db.String(20), default="37APVPR6953F1Z1")
    phone = db.Column(db.String(20), default="+91 98490 12345")
    email = db.Column(db.String(100), default="rcmobiles.madakasira@gmail.com")
    terms = db.Column(db.Text, default="1. Goods once sold will not be taken back or exchanged without valid invoice.\n2. Warranty claims are governed strictly by original manufacturer policy.\n3. Physical damage, liquid damage & unauthorized repairs void warranty.\n4. Subject to Madakasira Jurisdiction.")
    logo_path = db.Column(db.String(255), default="/api/uploads/logo.png")
    invoice_prefix = db.Column(db.String(10), default="RCM")
    invoice_counter = db.Column(db.Integer, default=1001)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            "id": self.id,
            "store_name": self.store_name,
            "address": self.address,
            "gstin": self.gstin,
            "phone": self.phone,
            "email": self.email,
            "terms": self.terms,
            "logo_path": self.logo_path,
            "invoice_prefix": self.invoice_prefix,
            "invoice_counter": self.invoice_counter
        }

class Product(db.Model):
    __tablename__ = 'products'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    brand = db.Column(db.String(100), default="Generic")
    category = db.Column(db.String(100), default="Mobile")
    hsn_code = db.Column(db.String(20), default="8517")
    purchase_price = db.Column(db.Float, default=0.0)
    selling_price = db.Column(db.Float, nullable=False)
    stock_qty = db.Column(db.Integer, default=1)
    tax_rate = db.Column(db.Float, default=18.0) # Standard 18% GST for mobiles/accessories
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "brand": self.brand,
            "category": self.category,
            "hsn_code": self.hsn_code,
            "purchase_price": self.purchase_price,
            "selling_price": self.selling_price,
            "stock_qty": self.stock_qty,
            "tax_rate": self.tax_rate,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else ""
        }

class Invoice(db.Model):
    __tablename__ = 'invoices'
    
    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(50), unique=True, nullable=False)
    invoice_date = db.Column(db.DateTime, default=datetime.utcnow)
    customer_name = db.Column(db.String(150), nullable=False)
    customer_phone = db.Column(db.String(20), nullable=False)
    customer_address = db.Column(db.Text, default="")
    customer_gstin = db.Column(db.String(20), default="")
    state_type = db.Column(db.String(20), default="INTRA_STATE") # INTRA_STATE (AP: CGST+SGST) or INTER_STATE (IGST)
    
    subtotal = db.Column(db.Float, default=0.0)
    discount_amount = db.Column(db.Float, default=0.0)
    taxable_amount = db.Column(db.Float, default=0.0)
    cgst_amount = db.Column(db.Float, default=0.0)
    sgst_amount = db.Column(db.Float, default=0.0)
    igst_amount = db.Column(db.Float, default=0.0)
    total_tax = db.Column(db.Float, default=0.0)
    grand_total = db.Column(db.Float, default=0.0)
    
    payment_mode = db.Column(db.String(50), default="Cash") # Cash, UPI, Card, Bajaj Finance, TVS Credit, EMI
    payment_status = db.Column(db.String(20), default="Paid") # Paid, Pending, Partial
    notes = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    items = db.relationship('InvoiceItem', backref='invoice', cascade='all, delete-orphan', lazy=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            "id": self.id,
            "invoice_number": self.invoice_number,
            "invoice_date": self.invoice_date.strftime("%Y-%m-%d %H:%M:%S") if self.invoice_date else "",
            "formatted_date": self.invoice_date.strftime("%d-%b-%Y %I:%M %p") if self.invoice_date else "",
            "customer_name": self.customer_name,
            "customer_phone": self.customer_phone,
            "customer_address": self.customer_address,
            "customer_gstin": self.customer_gstin,
            "state_type": self.state_type,
            "subtotal": self.subtotal,
            "discount_amount": self.discount_amount,
            "taxable_amount": self.taxable_amount,
            "cgst_amount": self.cgst_amount,
            "sgst_amount": self.sgst_amount,
            "igst_amount": self.igst_amount,
            "total_tax": self.total_tax,
            "grand_total": self.grand_total,
            "payment_mode": self.payment_mode,
            "payment_status": self.payment_status,
            "notes": self.notes,
            "items": [item.to_dict() for item in self.items]
        }

class InvoiceItem(db.Model):
    __tablename__ = 'invoice_items'
    
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)
    item_name = db.Column(db.String(200), nullable=False)
    hsn_code = db.Column(db.String(20), default="8517")
    imei_serial = db.Column(db.String(100), default="") # IMEI Number 1 / Serial Number
    quantity = db.Column(db.Integer, default=1)
    unit_price = db.Column(db.Float, nullable=False)
    tax_rate = db.Column(db.Float, default=18.0)
    taxable_value = db.Column(db.Float, default=0.0)
    cgst_amount = db.Column(db.Float, default=0.0)
    sgst_amount = db.Column(db.Float, default=0.0)
    igst_amount = db.Column(db.Float, default=0.0)
    total_amount = db.Column(db.Float, nullable=False)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            "id": self.id,
            "invoice_id": self.invoice_id,
            "product_id": self.product_id,
            "item_name": self.item_name,
            "hsn_code": self.hsn_code,
            "imei_serial": self.imei_serial,
            "quantity": self.quantity,
            "unit_price": self.unit_price,
            "tax_rate": self.tax_rate,
            "taxable_value": self.taxable_value,
            "cgst_amount": self.cgst_amount,
            "sgst_amount": self.sgst_amount,
            "igst_amount": self.igst_amount,
            "total_amount": self.total_amount
        }
