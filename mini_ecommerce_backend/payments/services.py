import requests
from django.conf import settings


class ShurjopayError(Exception):
    pass


def _base_url():
    return settings.SHURJOPAY_BASE_URL


def _safe_json(response):
    """Parse JSON safely — raise ShurjopayError with raw text if response isn't JSON."""
    try:
        return response.json()
    except Exception:
        raise ShurjopayError(
            f"ShurjoPay returned non-JSON response (HTTP {response.status_code}): {response.text[:300]}"
        )


def _get_token():
    response = requests.post(
        f'{_base_url()}/api/get_token',
        json={
            'username': settings.SHURJOPAY_USERNAME,
            'password': settings.SHURJOPAY_PASSWORD,
        },
        timeout=30,
    )
    data = _safe_json(response)
    if response.status_code != 200 or not data.get('token'):
        raise ShurjopayError(f"Token fetch failed: {data.get('message', 'Unknown error')}")
    return data


def create_payment(order, customer, client_ip='127.0.0.1'):
    """
    Initiate a payment with ShurjoPay.
    Returns dict with checkout_url and shurjopay_order_id.
    """
    token_data = _get_token()
    token = token_data['token']
    store_id = token_data['store_id']
    execute_url = token_data.get('execute_url', f'{_base_url()}/api/secret-pay')

    payload = {
        'prefix': settings.SHURJOPAY_PREFIX,
        'token': token,
        'store_id': store_id,
        'return_url': settings.SHURJOPAY_RETURN_URL,
        'cancel_url': settings.SHURJOPAY_CANCEL_URL,
        'amount': float(order.total_amount),
        'order_id': f'{settings.SHURJOPAY_PREFIX}-{order.id}',
        'currency': 'BDT',
        'client_ip': client_ip,
        'customer_name': (f'{customer.first_name} {customer.last_name}'.strip() or customer.email)[:50],
        'customer_email': customer.email,
        'customer_address': str(order.shipping_address),
        'customer_phone': '01700000000',  # placeholder — update when phone field added to profile
        'customer_city': 'Dhaka',
    }

    response = requests.post(
        execute_url,
        json=payload,
        headers={'Authorization': f'Bearer {token}'},
        timeout=30,
    )
    data = _safe_json(response)

    if response.status_code != 200 or not data.get('checkout_url'):
        raise ShurjopayError(f"Payment initiation failed: {data.get('message', 'Unknown error')}")

    return {
        'checkout_url': data['checkout_url'],
        'shurjopay_order_id': data.get('sp_order_id', ''),
        'sp_code': str(data.get('sp_code', '')),
        'sp_message': data.get('message', ''),
    }


def verify_payment(shurjopay_order_id):
    """
    Verify a payment status with ShurjoPay.
    Returns the verification response dict.
    """
    token_data = _get_token()
    token = token_data['token']

    response = requests.post(
        f'{_base_url()}/api/verification',
        json={'order_id': shurjopay_order_id},
        headers={'Authorization': f'Bearer {token}'},
        timeout=30,
    )
    data = _safe_json(response)

    if response.status_code != 200:
        raise ShurjopayError(f"Payment verification failed: {data.get('message', 'Unknown error')}")

    # ShurjoPay returns a list with one item
    if isinstance(data, list) and len(data) > 0:
        return data[0]
    return data
