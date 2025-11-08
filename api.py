# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup, NavigableString
import json
import os
import re
import sys
from random import uniform
import time
import requests 
from webdriver_manager.chrome import ChromeDriverManager
from flask_cors import CORS

# 設定檔案名稱
BOOKS_JSON_FILENAME = "books.json"
SERIES_JSON_FILENAME = "series.json"

def get_next_series_id():
    """獲取下一個可用的系列ID"""
    series_data = load_series_data()
    if not series_data:
        return 1
    return max(s.get("series_id", 0) for s in series_data) + 1

def load_series_data():
    """載入系列資料"""
    if os.path.exists(SERIES_JSON_FILENAME):
        with open(SERIES_JSON_FILENAME, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []
    return []

def save_series_data(series_data):
    """保存系列資料"""
    with open(SERIES_JSON_FILENAME, "w", encoding="utf-8") as f:
        json.dump(series_data, f, ensure_ascii=False, indent=4)

def get_or_create_series_info(series_name, initial_book_num=0):
    """
    根據系列名稱獲取或創建系列資訊 (ID, 順號, 當前最大集數)。
    initial_book_num 用於在創建新系列時，設定第一個集數。
    """
    series_data = load_series_data()
    
    for s in series_data:
        if s.get("series_name") == series_name:
            # 更新最大集數 (如果新的集數更大)
            if initial_book_num > s.get("current_max_book_num", 0):
                s["current_max_book_num"] = initial_book_num
                save_series_data(series_data) # 保存更新
            return s.get("series_id"), s.get("series_sequence"), s.get("current_max_book_num", 0)

    # 如果系列不存在，則創建新的
    new_series_id = get_next_series_id()
    new_series_sequence = len(series_data) + 1 
    
    new_series = {
        "series_id": new_series_id,
        "series_name": series_name,
        "series_sequence": new_series_sequence,
        "current_max_book_num": initial_book_num # 初始化最大集數
    }
    series_data.append(new_series)
    save_series_data(series_data)
    return new_series_id, new_series_sequence, new_series["current_max_book_num"]


def generate_internal_id(series_sequence, book_num):
    """
    生成8碼的內建序號。
    前4碼為系列的順號，後4碼為集數的順號。
    例如：系列順號1，集數1 -> 00010001
    系列順號10，集數5 -> 00100005
    """
    series_seq_str = str(series_sequence).zfill(4)
    book_num_str = str(book_num).zfill(4)
    return f"{series_seq_str}{book_num_str}"


def save_books_to_json(books, filename=BOOKS_JSON_FILENAME):
    books = [book for book in books if book is not None]
    if not books:
        return

    existing = []
    if os.path.exists(filename):
        with open(filename, "r", encoding="utf-8") as f:
            try:
                existing = json.load(f)
            except json.JSONDecodeError:
                existing = []

    # 使用內建序號 (internal_id) 來檢查是否重複，確保唯一性
    existing_internal_ids = {b.get("internal_id") for b in existing if b.get("internal_id")}
    new_books_to_add = []

    for new_book in books:
        if new_book.get("internal_id") and new_book["internal_id"] not in existing_internal_ids:
            new_books_to_add.append(new_book)
            existing_internal_ids.add(new_book["internal_id"]) # 添加到已存在ID集合中，避免本次批次內重複

    if not new_books_to_add:
        print("沒有新的書籍需要添加到 JSON。", file=sys.stderr)
        return

    existing.extend(new_books_to_add)
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=4)
    print(f"已成功添加 {len(new_books_to_add)} 本新書到 {filename}。", file=sys.stderr)


def fetch_book_detail(driver, url, book_type, series_name, book_num):
    try:
        driver.get(url)
        WebDriverWait(driver, 12).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'div.type02_p003'))
        )

        soup = BeautifulSoup(driver.page_source, 'html.parser')

        title = soup.select_one('h1').text.strip() if soup.select_one('h1') else ""
        meta_desc = soup.select_one('meta[name="description"]')
        desc_content = meta_desc["content"] if meta_desc else ""
        jp_title = ""
        match = re.search(r"原文名稱：([^，]+)", desc_content)
        jp_title = match.group(1).strip() if match else ""

        info_li = soup.select('div.type02_p003 li')
        author, illustrator, publisher, pub_date, language = "", "", "", "", ""

        for li in info_li:
            text = li.get_text(strip=True)
            if "作者" in text:
                for elem in li.children:
                    if isinstance(elem, NavigableString) and "作者" in elem:
                        next_a = elem.find_next("a", href=True)
                        if next_a:
                            author = next_a.text.strip()
                        break
            if book_type == "小說" and "繪者" in text:
                a_tag = li.find("a", href=True)
                illustrator = a_tag.text.strip() if a_tag else text.replace("繪者：", "").strip()
            if "出版社" in text:
                span = li.find("span")
                publisher = span.text.strip() if span else text.replace("出版社：", "").strip()
            if "出版日期" in text:
                pub_date = text.replace("出版日期：", "").strip()
            if "語言" in text:
                language = text.replace("語言：", "").strip()

        price = ""
        price_li = soup.select_one('ul.price li')
        if price_li:
            em_tag = price_li.find("em")
            price = em_tag.text.strip() + "元" if em_tag else price_li.get_text(strip=True).replace("定價：", "").strip()
            
        isbn = ""
        spec = ""
        detail_li = soup.select('div.mod_b.type02_m058 li')
        for li in detail_li:
            text = li.get_text(strip=True)
            if "ISBN" in text:
                isbn = text.replace("ISBN：", "").strip()
            if "規格" in text:
                spec = text.replace("規格：", "").replace(" ", "").strip()

        if not isbn:
            isbn = f"NOISBN_{title}"

        # 獲取或更新系列資訊 (包含最大集數)
        series_id, series_sequence, current_max_book_num = get_or_create_series_info(series_name, book_num)
        
        # 生成內建序號
        internal_id = generate_internal_id(series_sequence, book_num)

        img_path = ""
        img_meta = soup.select_one('meta[property="og:image"]')
        img_url = img_meta["content"] if img_meta else ""
        if img_url:
            try:
                os.makedirs("images", exist_ok=True)
                # 使用 internal_id 作為圖片檔名
                img_name = f"{internal_id}.jpg"
                img_path = os.path.join("images", img_name)
                # 下載圖片仍使用 requests，因為 Selenium 下載大檔案效率不高
                img_res = requests.get(img_url, timeout=10)
                img_res.raise_for_status()
                with open(img_path, "wb") as f:
                    f.write(img_res.content)
            except Exception as e:
                print(f"下載封面圖片失敗：{e}", file=sys.stderr)
                img_path = ""

        book = {
            "internal_id": internal_id, 
            "書名": title,
            "日文書名": jp_title,
            "作者": author,
            "出版社": publisher,
            "出版日期": pub_date,
            "語言": language,
            "定價": price,
            "ISBN": isbn,
            "規格": spec,
            "封面圖片": img_path,
            "系列": series_name,
            "系列順號": series_sequence, 
            "類別": book_type,
            "集數": book_num, 
        }
        if book_type == "小說":
            book["繪者"] = illustrator

        return book

    except Exception as e:
        print(f"處理網址 {url} 時發生錯誤：{e}", file=sys.stderr)
        return None


def get_first_book_url(driver, book_title, category):
    qqsub_value = '16' if category.lower() == '漫畫' else '15'
    processed_title = book_title.replace(' ', '+')

    search_url = f'https://search.books.com.tw/search/query/cat/1/qsub/001/qqsub/{qqsub_value}/sort/1/v/1/page/1/spell/3/ms2/ms2_1/key/{processed_title}'
    driver.get(search_url)

    try:
        wait = WebDriverWait(driver, 10)
        # 注意：這裡使用 div.table-td 可能是博客來舊的或不穩定的選擇器。
        # 如果爬取失敗，這會是第一個需要檢查的地方。
        # 更好的方法可能是觀察實際頁面，尋找更穩定的標籤，例如搜尋結果條目的通用 class
        book_container = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'div.table-td'))
        )
        book_links = book_container.find_elements(By.TAG_NAME, 'a')
        if len(book_links) > 1:
            first_book_link = book_links[1] # 通常第二個 <a> 是書籍連結
            redirect_url = first_book_link.get_attribute('href')
            match = re.search(r'item/(\d+)', redirect_url)
            if match:
                item_number = match.group(1)
                return f'https://www.books.com.tw/products/{item_number}?sloc=main'
    except Exception as e:
        print(f"在搜尋 '{book_title}' 時找不到相關書籍或發生錯誤: {e}", file=sys.stderr)
        return None
    return None

# ----------------- API -----------------
app = Flask(__name__)
CORS(app)

@app.route("/search", methods=["POST"])
def search_book():
    data = request.json
    book_title = data.get("bookTitle")
    series_name = data.get("series")
    book_type = "小說" if data.get("type") == "novel" else "漫畫"
    book_num = int(data.get("bookNum", 0)) # 預設集數為 0，如果前端未提供則後續會根據系列最大集數+1

    if not book_title:
        return jsonify({"error": "請輸入書名"}), 400
    if not series_name:
        return jsonify({"error": "請輸入系列名稱"}), 400

    options = Options()
    options.add_argument("--headless")  # 若要無頭模式可打開
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("user-agent=Mozilla/5.0")

    driver = None
    try:
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

        url = get_first_book_url(driver, book_title, book_type)
        if not url:
            return jsonify({"error": f"找不到 '{book_title}' 相關書籍"}), 404
        
        # 如果 book_num 是 0 (即前端未提供)，則從 series.json 獲取最大集數後加一
        # 注意：這個邏輯假設你在尋找「下一集」。如果前端明確傳遞了集數，則以前端為準。
        # 這裡的邏輯是，如果book_num為0，則會自動+1，否則就用傳入的book_num
        final_book_num = book_num
        if book_num == 0:
            _, _, current_max_book_num_in_series = get_or_create_series_info(series_name)
            final_book_num = current_max_book_num_in_series + 1


        book = fetch_book_detail(driver, url, book_type, series_name, final_book_num)
        if not book:
            return jsonify({"error": "取得書籍資訊失敗"}), 500

        # 在成功獲取書籍資訊後，更新 series.json 的最大集數
        # 這確保即使初始 book_num 為 0 (自動生成)，系列的最大集數也能正確更新
        get_or_create_series_info(series_name, final_book_num)

        # 存 JSON
        save_books_to_json([book])

        time.sleep(uniform(2, 5))
        return jsonify(book)

    except Exception as e:
        print(f"API 處理時發生錯誤: {e}", file=sys.stderr)
        return jsonify({"error": f"API 處理時發生錯誤: {str(e)}"}), 500
    finally:
        if driver:
            driver.quit()


if __name__ == "__main__":
    app.run(port=5000, debug=True)