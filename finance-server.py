import os
import re
import json
import requests
import logging
import csv
from bs4 import BeautifulSoup

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import pandas as pd
from datetime import datetime, timedelta

import yfinance as yf
from vnstock import Quote, Fund

# USING
# curl.exe -X POST http://localhost:8000/api/vngold/update-webgia?gold_type=sjc


# Giả sử bạn đã import hoặc định nghĩa sẵn Quote, Fund, filter_df_by_date_range ở đây
# from your_module import Quote, Fund, filter_df_by_date_range

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Cho phép mọi domain, hoặc list domain cụ thể
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CẤU HÌNH FILE DATA ---
FILE_MAP = {
    "sjc": "./data/sjc_gold_full_sources_backup.csv",
    "pnj": "./data/pnj_gold_mieng_giavang_org_backup.csv",
    "doji": "./data/doji_gold_backup.csv"
}

# --- HELPER FUNCTIONS CHO CRAWLER ---

def clean_price(text):
    """Chuyển text giá (VD: 87.000) thành số (87000)"""
    if not text:
        return None
    # Lấy phần số đầu tiên, bỏ dấu chấm
    return text.split()[0].replace(".", "").replace(",", "")

def fetch_gold_price_detail(url, expected_date, gold_type_key="sjc"):
    """
    Truy cập url chi tiết để lấy giá.
    gold_type_key: 'sjc', 'pnj', 'doji' để xác định keyword tìm kiếm.
    """
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        r = requests.get(url, headers=headers, timeout=10)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")

        # Check dữ liệu trống
        if "Không tìm thấy dữ liệu" in soup.get_text():
            return None

        # Xác định từ khóa tìm kiếm trong HTML dựa trên loại vàng
        keywords = []
        if gold_type_key == 'sjc':
            keywords = ["miếng", "sjc 1l"] # Thường là Vàng SJC 1L - 10L
        elif gold_type_key == 'pnj':
            keywords = ["nhẫn", "pnj"]
        elif gold_type_key == 'doji':
            keywords = ["nhẫn", "hưng thịnh"]

        target_block = None
        # Tìm tất cả các h2 trong box giá
        for h2 in soup.select("div.gold-price-box h2"):
            text = h2.get_text(strip=True).lower()
            # Nếu tiêu đề chứa từ khóa
            if any(k in text for k in keywords):
                target_block = h2.find_next("div", class_="row")
                break
        
        # Fallback cho SJC: nếu không tìm thấy, lấy block đầu tiên (thường là SJC thành phố lớn)
        if not target_block and gold_type_key == 'sjc':
            first_h2 = soup.select_one("div.gold-price-box h2")
            if first_h2:
                target_block = first_h2.find_next("div", class_="row")

        if not target_block:
            return None

        # Parse giá
        buy_span = target_block.select_one("div.box-cgre span.gold-price")
        sell_span = target_block.select_one("div.box-cred span.gold-price")
        
        buy_price = clean_price(buy_span.text) if buy_span else None
        sell_price = clean_price(sell_span.text) if sell_span else None
        
        # Trả về format khớp với CSV
        return {
            "date": expected_date, # Format YYYY-MM-DD
            "buy": buy_price,
            "sell": sell_price
        }
    except Exception as e:
        print(f"Lỗi fetch {url}: {e}")
        return None

def fetch_from_webgia(gold_type="sjc"):
    """
    Lấy dữ liệu lịch sử từ biểu đồ Webgia.com
    Lưu ý: URL này thường mặc định cho SJC.
    """
    # URL biểu đồ 1 năm của Webgia
    url = "https://webgia.com/gia-vang/sjc/bieu-do-1-nam.html"
    
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        r = requests.get(url, headers=headers, timeout=15)
        r.raise_for_status()
        html = r.text

        # Regex tìm biến seriesOptions trong script
        match = re.search(r"seriesOptions\s*=\s*(\[\{.*?\}\]);", html, re.S)
        if not match:
            print("Không tìm thấy dữ liệu seriesOptions trên Webgia.")
            return []

        js_data = match.group(1)

        # Fix format JS thành JSON hợp lệ
        # Thêm dấu ngoặc kép cho key (name:, data: -> "name":, "data":)
        js_data = re.sub(r"(\w+):", r'"\1":', js_data)
        # Xử lý trường hợp giá trị có dấu nháy đơn 'name' -> "name"
        js_data = js_data.replace("'", '"')
        
        series = json.loads(js_data)

        # Gom nhóm data theo ngày
        records = {}
        
        for s in series:
            name = s.get("name", "").lower()
            data_points = s.get("data", [])
            
            is_buy = "mua" in name
            is_sell = "bán" in name
            
            for ts, val in data_points:
                # Webgia timestamp tính bằng milliseconds
                date_str = datetime.fromtimestamp(ts / 1000).strftime("%Y-%m-%d")
                
                if date_str not in records:
                    records[date_str] = {"date": date_str, "buy": None, "sell": None}
                
                # Webgia đơn vị thường là triệu đồng (VD: 85.5) -> nhân 1000 để ra nghìn đồng (85500) khớp với CSV
                price = int(val * 1000)
                
                if is_buy:
                    records[date_str]["buy"] = price
                elif is_sell:
                    records[date_str]["sell"] = price

        # Chuyển dict thành list và sort
        result = list(records.values())
        result.sort(key=lambda x: x["date"])
        
        return result

    except Exception as e:
        print(f"Lỗi fetch Webgia: {e}")
        return []

def crawl_missing_data(gold_type, start_date, end_date):
    """
    gold_type: 'sjc', 'pnj'
    start_date, end_date: datetime objects
    """
    base_url = f"https://giavang.org/trong-nuoc/{gold_type}/lich-su"
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        r = requests.get(base_url, headers=headers, timeout=15)
        soup = BeautifulSoup(r.text, "html.parser")
        
        section = soup.select_one("main.container div.row.main.border-content section.col-12")
        if not section:
            return []

        new_data = []
        
        # Lấy danh sách link
        links = []
        for a in section.find_all("a", href=True):
            if "k" in a.get("class", []): continue # Bỏ qua nút next/prev
            
            href = a["href"]
            # Link format: .../2024-11-23.html
            if href.endswith(".html"):
                date_part = href.split("/")[-1].replace(".html", "")
                try:
                    link_date = datetime.strptime(date_part, "%Y-%m-%d")
                    # Lọc range: Start < Date <= End
                    if start_date < link_date <= end_date:
                        links.append((date_part, href))
                except ValueError:
                    continue
        
        # Sort để crawl từ cũ đến mới
        links.sort(key=lambda x: x[0])

        print(f"Tìm thấy {len(links)} ngày cần update cho {gold_type}...")

        for date_str, url in links:
            row = fetch_gold_price_detail(url, date_str, gold_type)
            if row and row.get("buy") and row.get("sell"):
                new_data.append(row)
        
        return new_data

    except Exception as e:
        print(f"Lỗi crawl: {e}")
        return []

def filter_df_by_date_range(df, start_date, end_date=None):
    """
    Lọc DataFrame theo khoảng thời gian.
    - df: DataFrame chứa cột 'timestamp' kiểu datetime
    - start_date, end_date: chuỗi ngày theo định dạng 'dd-mm-yyyy'
    
    Trả về DataFrame đã lọc theo thời gian.
    """
    if start_date:
        start = pd.to_datetime(start_date, dayfirst=True)
    else:
        start = df["timestamp"].min()

    if end_date:
        end = pd.to_datetime(end_date, dayfirst=True)
    else:
        end = df["timestamp"].max()
    
    # Lọc dữ liệu
    return df[(df["timestamp"] >= start) & (df["timestamp"] <= end)].copy()

def read_vnstock(ticker, is_fund=False, source='VCI', start=None, end=None):
    # Hàm bạn đã cho
    if not is_fund:
        quote = Quote(symbol=ticker, source=source)
        if start is None:
            start = "01-01-2020"
        if end is None:
            end = pd.to_datetime("today").strftime('%d-%m-%Y')
        start = pd.to_datetime(start, dayfirst=True).strftime('%Y-%m-%d')
        end = pd.to_datetime(end, dayfirst=True).strftime('%Y-%m-%d')

        # Lấy dữ liệu và đổi tên cột
        df = quote.history(start=start, end=end)[['time', 'close']].rename(columns={'time': 'timestamp', 'close': 'value'})
        
        # --- DÒNG THÊM VÀO ĐỂ SỬA LỖI ---
        # Chuyển đổi cột 'timestamp' sang kiểu datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        return df
    else:
        fund_nav = Fund().details.nav_report(ticker)
        fund_nav = fund_nav.rename(columns={'date': 'timestamp', 'nav_per_unit': 'value'})
        fund_nav['timestamp'] = pd.to_datetime(fund_nav['timestamp'], format='%Y-%m-%d')
        df_fund = filter_df_by_date_range(fund_nav, start, (datetime.strptime(end, "%d-%m-%Y") + timedelta(days=1)).strftime("%d-%m-%Y"))
        df_fund['value'] = df_fund['value'].shift(-1)
        return df_fund[:-1]

def read_vnstock(ticker, is_fund=False, source='VCI', start=None, end=None):
    if not is_fund:
        quote = Quote(symbol=ticker, source=source)
        if start is None:
            start = "01-01-2020"
        if end is None:
            end = pd.to_datetime("today").strftime('%d-%m-%Y')
        start = pd.to_datetime(start, dayfirst=True).strftime('%Y-%m-%d')
        end = pd.to_datetime(end, dayfirst=True).strftime('%Y-%m-%d')
        return (
            quote.history(start=start, end=end)[['time', 'close']]
            .rename(columns={'time': 'timestamp', 'close': 'value'})
        )
    else:
        try:
            # Cách cũ (không có symbol trong Fund())
            fund_nav = Fund().details.nav_report(ticker)
        except (ValueError, AttributeError):
            # Fallback: tạo Fund với symbol trước
            fund_nav = Fund(symbol=ticker).details.nav_report()

        fund_nav = fund_nav.rename(columns={'date': 'timestamp', 'nav_per_unit': 'value'})
        fund_nav['timestamp'] = pd.to_datetime(fund_nav['timestamp'], format='%Y-%m-%d')

        # Nếu chưa có filter_df_by_date_range, bạn có thể thay bằng đoạn lọc tạm này:
        if start is None:
            start = "01-01-2020"
        if end is None:
            end = pd.to_datetime("today").strftime('%d-%m-%Y')

        start_dt = pd.to_datetime(start, dayfirst=True)
        end_dt = pd.to_datetime(end, dayfirst=True) + timedelta(days=1)
        df_fund = fund_nav[(fund_nav['timestamp'] >= start_dt) & (fund_nav['timestamp'] < end_dt)]

        df_fund['value'] = df_fund['value'].shift(-1)
        return df_fund[:-1]

def read_vnstock(ticker, is_fund=False, source='VCI', start=None, end=None):
    if not is_fund:
        quote = Quote(symbol=ticker, source=source)

        if start is None:
            start = "01-01-2020"
        if end is None:
            end = pd.to_datetime("today").strftime('%d-%m-%Y')

        # Chuyển start/end sang định dạng chuẩn yyyy-mm-dd cho API
        start = pd.to_datetime(start, dayfirst=True).strftime('%Y-%m-%d')
        end = pd.to_datetime(end, dayfirst=True).strftime('%Y-%m-%d')

        df = (
            quote.history(start=start, end=end)[['time', 'close']]
            .rename(columns={'time': 'timestamp', 'close': 'value'})
        )

        # 🔧 Ép timestamp sang datetime64 để đồng bộ với fund_df
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")

        return df
    else:
        try:
            # Cách cũ (không có symbol trong Fund())
            fund_nav = Fund().details.nav_report(ticker)
        except (ValueError, AttributeError):
            # Fallback: tạo Fund với symbol trước
            fund_nav = Fund(ticker).details.nav_report()

        fund_nav = fund_nav.rename(columns={'date': 'timestamp', 'nav_per_unit': 'value'})
        fund_nav['timestamp'] = pd.to_datetime(fund_nav['timestamp'], format='%Y-%m-%d')

        # Nếu chưa có filter_df_by_date_range, bạn có thể thay bằng đoạn lọc tạm này:
        if start is None:
            start = "01-01-2020"
        if end is None:
            end = pd.to_datetime("today").strftime('%d-%m-%Y')

        start_dt = pd.to_datetime(start, dayfirst=True)
        end_dt = pd.to_datetime(end, dayfirst=True) + timedelta(days=1)
        df_fund = fund_nav[(fund_nav['timestamp'] >= start_dt) & (fund_nav['timestamp'] < end_dt)]

        df_fund['value'] = df_fund['value'].shift(-1)
        return df_fund[:-1]

def read_yfinance(ticker="BTC-USD", start=None, end=None):
    # yf download -> lỗi cache khi call api nhiều lần cùng lúc
    # res = yf.download(
    #     ticker, 
    #     start=datetime.strptime(start if start else "01-01-2020", "%d-%m-%Y").strftime("%Y-%m-%d"), 
    #     end=datetime.strptime(end, "%d-%m-%Y").strftime("%Y-%m-%d") if end else pd.to_datetime("today").strftime('%Y-%m-%d'),
    #     interval="1d", 
    #     progress=False
    # )

    # df = res[['Close']].reset_index()
    # df.columns = ['timestamp', 'value']

    # yf Ticker
    yf_ticker = yf.Ticker(ticker)
    hist = yf_ticker.history(
        start=datetime.strptime(start if start else "01-01-2020", "%d-%m-%Y"),
        end=datetime.strptime(end, "%d-%m-%Y") if end else pd.to_datetime("today"),
        interval="1d"
    )
    df = hist[['Close']].reset_index()
    df.columns = ['timestamp', 'value']

    return df

def read_gold(
    gold_type: str = "sjc", 
    price_type: str = "buy", 
    start: Optional[str] = None, 
    end: Optional[str] = None
):
    """
    Đọc dữ liệu giá vàng từ CSV đã crawl sẵn.
    - gold_type: sjc, pnj, doji (mặc định sjc)
    - price_type: buy hoặc sell
    - start, end: ngày dd-mm-yyyy
    """
    if gold_type not in FILE_MAP:
        raise ValueError(f"Unsupported gold_type={gold_type}, chỉ hỗ trợ {list(FILE_MAP.keys())}")

    file_path = FILE_MAP[gold_type]
    df = pd.read_csv(file_path)

    # Chuẩn hóa ngày
    df["timestamp"] = pd.to_datetime(df["date"])

    # Chọn cột giá
    if price_type not in ["buy", "sell"]:
        raise ValueError("price_type phải là 'buy' hoặc 'sell'")

    df = df[["timestamp", price_type]].rename(columns={price_type: "value"})

    # Lọc theo thời gian
    df = filter_df_by_date_range(df, start, end)

    return df

@app.post("/api/vngold/update")
def update_gold_data(
    gold_type: str = Query("sjc", description="Loại vàng: sjc, pnj")
):
    if gold_type not in FILE_MAP:
        raise HTTPException(status_code=400, detail=f"Chưa hỗ trợ loại vàng {gold_type}")

    file_path = FILE_MAP[gold_type]
    
    # 1. Đọc dữ liệu hiện tại
    try:
        if os.path.exists(file_path):
            # Đọc csv, tự động parse date
            df = pd.read_csv(file_path)
            
            # Chuẩn hóa tên cột (để tránh lỗi Case Sensitive)
            df.columns = [c.lower().strip() for c in df.columns]
            
            # Convert cột date sang datetime để so sánh
            # format='mixed' để handle cả '7/22/2009' lẫn '2024-01-01'
            df['date'] = pd.to_datetime(df['date'], format='mixed', dayfirst=False) 
            
            max_date = df['date'].max()
        else:
            # Nếu file chưa có, set mốc quá khứ xa
            df = pd.DataFrame(columns=["date", "buy", "sell"])
            max_date = datetime(2010, 1, 1)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi đọc file CSV: {str(e)}")

    today = datetime.now()
    
    # Nếu dữ liệu đã mới nhất (max_date >= hôm nay hoặc hôm qua)
    if max_date.date() >= today.date():
        return {
            "status": "latest", 
            "message": "Dữ liệu đã cập nhật đến mới nhất.", 
            "latest_date": max_date.strftime("%Y-%m-%d")
        }

    # 2. Crawl dữ liệu thiếu
    # Crawl từ (max_date + 1 ngày) đến Today
    print(f"Crawl {gold_type} từ {max_date} đến {today}")
    new_rows = crawl_missing_data(gold_type, max_date, today)
    
    if not new_rows:
        return {
            "status": "no_new_data",
            "message": "Không tìm thấy dữ liệu mới trên web nguồn.",
            "last_checked": max_date.strftime("%Y-%m-%d")
        }

    # 3. Merge và Lưu file
    try:
        new_df = pd.DataFrame(new_rows)
        new_df['date'] = pd.to_datetime(new_df['date'])
        
        # Nối data cũ và mới
        combined_df = pd.concat([df, new_df])
        
        # Drop duplicate theo date, giữ cái mới nhất nếu trùng
        combined_df = combined_df.drop_duplicates(subset=['date'], keep='last')
        
        # Sort lại theo ngày
        combined_df = combined_df.sort_values(by='date')
        
        # Format lại date thành string chuẩn YYYY-MM-DD trước khi lưu
        combined_df['date'] = combined_df['date'].dt.strftime('%Y-%m-%d')
        
        # Lưu đè file CSV
        combined_df.to_csv(file_path, index=False)
        
        return {
            "status": "success",
            "message": f"Đã cập nhật thêm {len(new_rows)} dòng dữ liệu.",
            "latest_date": combined_df['date'].iloc[-1],
            "added_dates": [r['date'] for r in new_rows]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu file: {str(e)}")

@app.post("/api/vngold/update-webgia")
def update_gold_data_webgia(
    gold_type: str = Query("sjc", description="Loại vàng: sjc (Webgia chủ yếu hỗ trợ SJC)")
):
    """
    Cập nhật dữ liệu vàng SJC từ nguồn Webgia.com
    Nhanh hơn crawl từng trang, nhưng chỉ lấy được SJC.
    """
    if gold_type != "sjc":
        raise HTTPException(status_code=400, detail="Webgia source hiện tại tối ưu nhất cho dữ liệu 'sjc'.")

    if gold_type not in FILE_MAP:
        raise HTTPException(status_code=400, detail=f"Không tìm thấy file cấu hình cho {gold_type}")

    file_path = FILE_MAP[gold_type]

    # 1. Đọc dữ liệu hiện tại
    try:
        if os.path.exists(file_path):
            df = pd.read_csv(file_path)
            df.columns = [c.lower().strip() for c in df.columns]
            df['date'] = pd.to_datetime(df['date'], format='mixed', dayfirst=False)
            max_date = df['date'].max()
        else:
            df = pd.DataFrame(columns=["date", "buy", "sell"])
            max_date = datetime(2010, 1, 1)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi đọc file CSV: {str(e)}")

    # 2. Fetch dữ liệu từ Webgia (Lấy toàn bộ 1 năm qua)
    webgia_data = fetch_from_webgia(gold_type)
    
    if not webgia_data:
        return {"status": "failed", "message": "Không lấy được dữ liệu từ Webgia."}

    # 3. Lọc dữ liệu mới (Date > Max Date hiện tại)
    new_rows = []
    for row in webgia_data:
        row_date = datetime.strptime(row['date'], "%Y-%m-%d")
        if row_date > max_date:
            new_rows.append(row)

    if not new_rows:
        return {
            "status": "latest",
            "message": "Dữ liệu đã ở mức mới nhất so với Webgia.",
            "last_date_in_file": max_date.strftime("%Y-%m-%d")
        }

    # 4. Merge và Lưu
    try:
        new_df = pd.DataFrame(new_rows)
        new_df['date'] = pd.to_datetime(new_df['date'])
        
        # Concat
        combined_df = pd.concat([df, new_df])
        
        # Drop duplicates (Ưu tiên lấy data mới nhất nếu trùng ngày)
        combined_df = combined_df.drop_duplicates(subset=['date'], keep='last')
        combined_df = combined_df.sort_values(by='date')
        
        # Format date chuẩn YYYY-MM-DD
        combined_df['date'] = combined_df['date'].dt.strftime('%Y-%m-%d')
        
        combined_df.to_csv(file_path, index=False)

        return {
            "status": "success",
            "message": f"Đã cập nhật {len(new_rows)} ngày từ Webgia.",
            "latest_date": combined_df['date'].iloc[-1],
            "added_dates": [r['date'] for r in new_rows]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu file: {str(e)}")

@app.get("/api/vnstock")
def api_vnstock(
    ticker: str = Query(..., description="Ticker symbol"),
    is_fund: Optional[bool] = Query(False, description="Is fund data"),
    source: Optional[str] = Query('VCI', description="Data source"),
    start: Optional[str] = Query(None, description="Start date (dd-mm-yyyy)"),
    end: Optional[str] = Query(None, description="End date (dd-mm-yyyy)")
):
    try:
        df = read_vnstock(ticker, is_fund, source, start, end)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Convert dataframe 'timestamp' datetime thành string ISO format để trả JSON được
    df = df.copy()
    df['timestamp'] = df['timestamp'].dt.strftime('%Y-%m-%dT%H:%M:%S')

    # Trả về list dict JSON
    return df.to_dict(orient='records')

@app.get("/api/yfinance")
def api_yfinance(
    ticker: str = Query(..., description="Ticker symbol, ví dụ: BTC-USD, AAPL"),
    start: str = Query(None, description="Start date (dd-mm-yyyy)"),
    end: str = Query(None, description="End date (dd-mm-yyyy)")
):
    try:
        df = read_yfinance(ticker, start, end)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Chuyển datetime thành ISO string
    df = df.copy()
    df['timestamp'] = df['timestamp'].dt.strftime('%Y-%m-%dT%H:%M:%S')

    # Trả về dạng JSON list
    return df.to_dict(orient='records')

@app.get("/api/vngold")
def api_vngold(
    gold_type: str = Query("sjc", description="Loại vàng: sjc, pnj, doji"),
    price_type: str = Query("sell", description="Loại giá: buy hoặc sell"),
    start: str = Query(None, description="Start date (dd-mm-yyyy)"),
    end: str = Query(None, description="End date (dd-mm-yyyy)")
):
    try:
        df = read_gold(gold_type, price_type, start, end)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    df = df.copy()
    df["timestamp"] = df["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%S")
    return df.to_dict(orient="records")

CACHE_MAP = {
    "DCDS": "./cache/DCDS.json",
    "FUEVFVND": "./cache/FUEVFVND.json"
}

def read_cache_fund(ticker, is_fund=False, start=None, end=None):
    if is_fund:
        # NAV → phải đúng ticker
        if ticker not in CACHE_MAP:
            raise ValueError("Only support DCDS, FUEVFVND")

        path = CACHE_MAP[ticker]
        key = "fundData"
    else:
        # VNINDEX → lấy từ bất kỳ file nào (ví dụ file đầu tiên)
        path = list(CACHE_MAP.values())[0]
        key = "fundBenchmarkData"

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    rows = data["returnValue"][key]

    df = pd.DataFrame(rows)

    df = df.rename(columns={
        "navDate": "timestamp",
        "navPrice": "value"
    })

    # --- CLEAN TRIỆT ĐỂ ---
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df["value"] = pd.to_numeric(df["value"], errors="coerce")

    df = df.dropna(subset=["timestamp", "value"])
    df = df[~df["value"].isin([float("inf"), float("-inf")])]

    # filter
    if start:
        df = df[df["timestamp"] >= pd.to_datetime(start, dayfirst=True)]
    if end:
        df = df[df["timestamp"] <= pd.to_datetime(end, dayfirst=True)]

    return df[["timestamp", "value"]]

@app.get("/api/vnstock0")
def api_cache(
    ticker: str = Query(...),
    is_fund: bool = Query(False),
    start: str = Query(None),
    end: str = Query(None)
):
    try:
        df = read_cache_fund(ticker.upper(), is_fund, start, end)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    df = df.copy()

    # 1. Ép kiểu an toàn
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df["value"] = pd.to_numeric(df["value"], errors="coerce")

    # 2. Drop toàn bộ giá trị invalid (quan trọng)
    df = df.dropna(subset=["timestamp", "value"])

    # 3. Loại inf (edge case)
    df = df[~df["value"].isin([float("inf"), float("-inf")])]

    # 4. Format lại timestamp
    df["timestamp"] = df["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%S")

    # 5. Convert JSON-safe
    return df.to_dict(orient="records")
