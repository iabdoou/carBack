"""
Backend API Tests for Trust Auto Vehicle Dashboard
Tests authentication, admin, supplier, and buyer endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"email": "admin@trustauto.dz", "password": "password123"}
SUPPLIER_CREDS = {"email": "supplier@trustauto.dz", "password": "password123"}
BUYER_CREDS = {"email": "ahmed@client.dz", "password": "password123"}


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_admin_login_success(self):
        """Test admin login returns token and correct role"""
        response = requests.post(
            f"{BASE_URL}/api/v1/auth/login",
            json=ADMIN_CREDS,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200 or response.status_code == 201
        data = response.json()
        assert "accessToken" in data
        assert "user" in data
        assert data["user"]["role"] == "ADMIN"
        assert data["user"]["email"] == ADMIN_CREDS["email"]
    
    def test_supplier_login_success(self):
        """Test supplier login returns token and correct role"""
        response = requests.post(
            f"{BASE_URL}/api/v1/auth/login",
            json=SUPPLIER_CREDS,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200 or response.status_code == 201
        data = response.json()
        assert "accessToken" in data
        assert data["user"]["role"] == "SUPPLIER"
    
    def test_buyer_login_success(self):
        """Test buyer login returns token and correct role"""
        response = requests.post(
            f"{BASE_URL}/api/v1/auth/login",
            json=BUYER_CREDS,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200 or response.status_code == 201
        data = response.json()
        assert "accessToken" in data
        assert data["user"]["role"] == "BUYER"
    
    def test_login_invalid_credentials(self):
        """Test login with wrong password returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/v1/auth/login",
            json={"email": "admin@trustauto.dz", "password": "wrongpassword"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401


@pytest.fixture
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        json=ADMIN_CREDS,
        headers={"Content-Type": "application/json"}
    )
    if response.status_code in [200, 201]:
        return response.json().get("accessToken")
    pytest.skip("Admin authentication failed")


@pytest.fixture
def supplier_token():
    """Get supplier authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        json=SUPPLIER_CREDS,
        headers={"Content-Type": "application/json"}
    )
    if response.status_code in [200, 201]:
        return response.json().get("accessToken")
    pytest.skip("Supplier authentication failed")


@pytest.fixture
def buyer_token():
    """Get buyer authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        json=BUYER_CREDS,
        headers={"Content-Type": "application/json"}
    )
    if response.status_code in [200, 201]:
        return response.json().get("accessToken")
    pytest.skip("Buyer authentication failed")


class TestAdminEndpoints:
    """Admin API endpoint tests"""
    
    def test_admin_stats(self, admin_token):
        """Test admin dashboard stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/v1/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Verify stats structure
        assert "activeOrders" in data or "totalListings" in data or "totalBuyers" in data
    
    def test_admin_get_buyers(self, admin_token):
        """Test get all buyers endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/v1/admin/users/buyers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have at least the seeded buyers
        assert len(data) >= 1
    
    def test_admin_get_listings(self, admin_token):
        """Test get all listings endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/v1/admin/listings",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have seeded listings
        assert len(data) >= 1
    
    def test_admin_get_listings_by_mode(self, admin_token):
        """Test filtering listings by mode"""
        for mode in ["IN_STOCK", "ON_ORDER", "IN_TRANSIT"]:
            response = requests.get(
                f"{BASE_URL}/api/v1/admin/listings?mode={mode}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            # All returned listings should have the requested mode
            for listing in data:
                assert listing.get("mode") == mode
    
    def test_admin_get_orders(self, admin_token):
        """Test get all orders endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/v1/admin/orders",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have seeded orders
        assert len(data) >= 1
    
    def test_admin_get_offers(self, admin_token):
        """Test get all supplier offers endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/v1/admin/offers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_admin_get_vehicle_models(self, admin_token):
        """Test get vehicle models endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/v1/admin/vehicle-models",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_admin_get_stock_ledger(self, admin_token):
        """Test get stock ledger endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/v1/admin/stock-ledger",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_admin_unauthorized_without_token(self):
        """Test admin endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/v1/admin/stats")
        assert response.status_code == 401


class TestSupplierEndpoints:
    """Supplier API endpoint tests"""
    
    def test_supplier_stats(self, supplier_token):
        """Test supplier dashboard stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/v1/supplier/stats",
            headers={"Authorization": f"Bearer {supplier_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Verify stats structure
        assert "totalOffers" in data or "pendingOffers" in data
    
    def test_supplier_get_offers(self, supplier_token):
        """Test get supplier's own offers"""
        response = requests.get(
            f"{BASE_URL}/api/v1/supplier/offers",
            headers={"Authorization": f"Bearer {supplier_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_supplier_get_trims(self, supplier_token):
        """Test get available trims for creating offers"""
        response = requests.get(
            f"{BASE_URL}/api/v1/supplier/trims",
            headers={"Authorization": f"Bearer {supplier_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_supplier_unauthorized_without_token(self):
        """Test supplier endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/v1/supplier/stats")
        assert response.status_code == 401
    
    def test_supplier_cannot_access_admin(self, supplier_token):
        """Test supplier cannot access admin endpoints"""
        response = requests.get(
            f"{BASE_URL}/api/v1/admin/stats",
            headers={"Authorization": f"Bearer {supplier_token}"}
        )
        assert response.status_code == 403


class TestBuyerEndpoints:
    """Buyer API endpoint tests"""
    
    def test_buyer_stats(self, buyer_token):
        """Test buyer dashboard stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/v1/buyer/stats",
            headers={"Authorization": f"Bearer {buyer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Verify stats structure
        assert "totalOrders" in data or "activeOrders" in data
    
    def test_buyer_get_orders(self, buyer_token):
        """Test get buyer's own orders"""
        response = requests.get(
            f"{BASE_URL}/api/v1/buyer/orders",
            headers={"Authorization": f"Bearer {buyer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_buyer_get_timeline_steps(self, buyer_token):
        """Test get timeline steps for different modes"""
        for mode in ["IN_STOCK", "ON_ORDER", "IN_TRANSIT"]:
            response = requests.get(
                f"{BASE_URL}/api/v1/buyer/timeline-steps/{mode}",
                headers={"Authorization": f"Bearer {buyer_token}"}
            )
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
    
    def test_buyer_unauthorized_without_token(self):
        """Test buyer endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/v1/buyer/stats")
        assert response.status_code == 401
    
    def test_buyer_cannot_access_admin(self, buyer_token):
        """Test buyer cannot access admin endpoints"""
        response = requests.get(
            f"{BASE_URL}/api/v1/admin/stats",
            headers={"Authorization": f"Bearer {buyer_token}"}
        )
        assert response.status_code == 403
    
    def test_buyer_cannot_access_supplier(self, buyer_token):
        """Test buyer cannot access supplier endpoints"""
        response = requests.get(
            f"{BASE_URL}/api/v1/supplier/stats",
            headers={"Authorization": f"Bearer {buyer_token}"}
        )
        assert response.status_code == 403


class TestDataIntegrity:
    """Test data integrity and relationships"""
    
    def test_listing_has_trim_info(self, admin_token):
        """Test listings include trim and vehicle model info"""
        response = requests.get(
            f"{BASE_URL}/api/v1/admin/listings",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        if len(data) > 0:
            listing = data[0]
            assert "trim" in listing
            assert "vehicleModel" in listing.get("trim", {})
    
    def test_order_has_buyer_and_listing_info(self, admin_token):
        """Test orders include buyer and listing info"""
        response = requests.get(
            f"{BASE_URL}/api/v1/admin/orders",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        if len(data) > 0:
            order = data[0]
            assert "buyer" in order
            assert "listing" in order


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
