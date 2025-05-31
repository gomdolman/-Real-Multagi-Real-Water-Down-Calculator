let transactions = [];
let lastCalculatedBreakevenPriceWithFee = null; // 수수료 포함 평단가
let lastCalculatedCurrentQuantity = 0;
let isCalculating = false; 

let buyFeeRate = 0.0005; // 기본 매수 수수료율 0.05%
let sellFeeRate = 0.0005; // 기본 매도 수수료율 0.05%

// --- 유틸리티 함수 ---
function formatNumber(numStr, maxDecimals = 8, minDecimals = 0) {
    if (numStr === null || numStr === undefined || String(numStr).trim() === '' || isNaN(parseFloat(String(numStr)))) return '0'; // 숫자가 아니면 '0' 또는 빈 문자열 반환
    const num = parseFloat(String(numStr));
    return num.toLocaleString(undefined, {
        minimumFractionDigits: minDecimals,
        maximumFractionDigits: maxDecimals
    });
}

function parseFormattedNumber(formattedStr) {
    if (formattedStr === null || formattedStr === undefined || String(formattedStr).trim() === '') return 0;
    const num = parseFloat(String(formattedStr).replace(/[^0-9.-]/g, '')); // 음수도 고려
    return isNaN(num) ? 0 : num;
}

function handleRawInput(inputElement, isFeeRate = false) {
    let value = inputElement.value;
    let numericValue = value.replace(isFeeRate ? /[^0-9.]/g : /[^0-9.]/g, ''); // 수수료율은 양수만
    
    const parts = numericValue.split('.');
    if (parts.length > 2) { 
        numericValue = parts[0] + '.' + parts.slice(1).join('');
    }
    inputElement.dataset.raw_value = numericValue;

    if (numericValue) {
        const [integerPart, decimalPart] = numericValue.split('.');
        const intPartForLocale = (integerPart === "" && decimalPart !== undefined) ? "0" : integerPart;
        // 수수료율은 %가 아니라 바로 소수점으로 사용하므로 toLocaleString 불필요할 수 있음.
        // 또는 %로 입력받고 내부에서 /100 처리
        const formattedInteger = (intPartForLocale && intPartForLocale !== "") ? parseFloat(intPartForLocale).toLocaleString('ko-KR', {maximumFractionDigits: 5}) : (integerPart === "" ? "" : "0");
        inputElement.value = decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger;
    } else if (value !== "" && value !== "-") { 
        inputElement.value = '';
    }
}

// --- 수수료율 처리 ---
function handleFeeRateInput(inputElement) {
    handleRawInput(inputElement, true); // 수수료율 플래그 전달
    const value = parseFormattedNumber(inputElement.dataset.raw_value || inputElement.value);
    const rate = value / 100; // %를 소수점으로 변환

    if (inputElement.id === 'buy-fee-rate') {
        buyFeeRate = isNaN(rate) ? 0 : rate;
    } else if (inputElement.id === 'sell-fee-rate') {
        sellFeeRate = isNaN(rate) ? 0 : rate;
    }
    // 수수료율 변경 시 즉시 시뮬레이션 업데이트는 oninput에서 runSimulation() 호출
}


// --- 입력 필드 연동 및 실시간 시뮬레이션 ---
function handleInputChange(changedField) {
    if (isCalculating) return; 
    isCalculating = true;

    const priceInput = document.getElementById('price');
    const quantityInput = document.getElementById('quantity');
    const totalAmountInput = document.getElementById('total-amount');

    // 입력 즉시 raw_value 업데이트 및 화면 포맷팅
    handleRawInput(priceInput); 
    handleRawInput(quantityInput);
    handleRawInput(totalAmountInput);

    let price = parseFormattedNumber(priceInput.dataset.raw_value);
    let quantity = parseFormattedNumber(quantityInput.dataset.raw_value);
    let totalAmount = parseFormattedNumber(totalAmountInput.dataset.raw_value);
    
    if (changedField === 'price' || changedField === 'quantity') {
        if (price > 0 && quantity > 0) {
            totalAmount = price * quantity;
            totalAmountInput.value = formatNumber(String(totalAmount), 2); 
            totalAmountInput.dataset.raw_value = String(totalAmount); 
        } else if (changedField !== 'total-amount' && (price <=0 || quantity <=0)) { 
            totalAmountInput.value = ''; 
            delete totalAmountInput.dataset.raw_value;
        }
    } else if (changedField === 'total-amount') {
        if (price > 0 && totalAmount > 0) {
            quantity = totalAmount / price;
            quantityInput.value = formatNumber(String(quantity), 8);
            quantityInput.dataset.raw_value = String(quantity);
        } else if (changedField !== 'quantity' && price <= 0) { 
             quantityInput.value = ''; 
             delete quantityInput.dataset.raw_value;
        }
    }
    
    runSimulation();
    isCalculating = false;
}

function getNumericInputValue(elementId) {
    const inputElement = document.getElementById(elementId);
    return parseFormattedNumber(inputElement.dataset.raw_value || inputElement.value);
}

function runSimulation() {
    const type = document.getElementById('transaction-type').value;
    const price = getNumericInputValue('price');
    const quantity = getNumericInputValue('quantity');

    let previewTransaction = null;
    if (quantity > 0 && price > 0) {
        const executionAmount = price * quantity;
        let fee = 0;
        if (type === 'buy') {
            fee = executionAmount * buyFeeRate;
        } else { // sell
            fee = executionAmount * sellFeeRate;
        }
        previewTransaction = { type, quantity, price, executionAmount, fee };
    }
    calculateResults(previewTransaction, false); 
}

// --- 거래 내역 관리 ---
function addTransaction() {
    const type = document.getElementById('transaction-type').value;
    const quantity = getNumericInputValue('quantity');
    const price = getNumericInputValue('price'); // 순수 체결가

    if (quantity <= 0 || price <= 0) {
        alert('유효한 수량과 단가를 입력해주세요 (0보다 커야 합니다).');
        return;
    }

    const executionAmount = price * quantity;
    let fee = 0;
    if (type === 'buy') {
        fee = executionAmount * buyFeeRate;
    } else { // sell
        fee = executionAmount * sellFeeRate;
    }

    transactions.push({ type, quantity, price, executionAmount, fee, id: Date.now() });
    renderTransactionList();
    calculateResults(null, true); // isFinalCalculation = true

    document.getElementById('price').value = '';
    document.getElementById('quantity').value = '';
    document.getElementById('total-amount').value = '';
    // dataset.raw_value도 클리어
    ['price', 'quantity', 'total-amount'].forEach(id => delete document.getElementById(id).dataset.raw_value);
    
    runSimulation(); 
    document.getElementById('price').focus();
}

function editTransaction(id) {
    const transactionIndex = transactions.findIndex(t => t.id === id);
    if (transactionIndex === -1) return;
    const oldTransaction = transactions[transactionIndex];

    const newQuantityRaw = prompt(`수량 수정 (기존: ${formatNumber(String(oldTransaction.quantity),8)}):`, oldTransaction.quantity);
    if (newQuantityRaw === null) return;
    const newPriceRaw = prompt(`단가 (체결가) 수정 (기존: ${formatNumber(String(oldTransaction.price),2)} 원):`, oldTransaction.price);
    if (newPriceRaw === null) return;

    const newQuantity = parseFormattedNumber(newQuantityRaw);
    const newPrice = parseFormattedNumber(newPriceRaw);

    if (isNaN(newQuantity) || newQuantity <= 0 || isNaN(newPrice) || newPrice <= 0) {
        alert('유효한 수량과 단가를 입력해주세요.');
        return;
    }
    
    const newExecutionAmount = newPrice * newQuantity;
    let newFee = 0;
    if (oldTransaction.type === 'buy') {
        newFee = newExecutionAmount * buyFeeRate;
    } else { // sell
        newFee = newExecutionAmount * sellFeeRate;
    }

    transactions[transactionIndex] = {
        ...oldTransaction, // type, id 유지
        quantity: newQuantity,
        price: newPrice,
        executionAmount: newExecutionAmount,
        fee: newFee
    };
    renderTransactionList();
    calculateResults(null, true); // isFinalCalculation = true
}

function deleteTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    renderTransactionList();
    calculateResults(null, true); // isFinalCalculation = true
}

function renderTransactionList() {
    const listElement = document.getElementById('transaction-list');
    listElement.innerHTML = ''; 
    transactions.forEach((t) => {
        const listItem = document.createElement('li');
        const feeText = t.fee > 0 ? ` (수수료: ${formatNumber(String(t.fee), 2)}원)` : '';
        const infoSpan = document.createElement('span');
        infoSpan.className = 'transaction-info';
        infoSpan.textContent = 
            `${t.type === 'buy' ? '매수' : '매도'}: ${formatNumber(String(t.quantity),8)} @ ${formatNumber(String(t.price),2)}원 ` +
            `= ${formatNumber(String(t.executionAmount),2)}원${feeText}`;
        
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'action-buttons';
        const editBtn = document.createElement('button');
        editBtn.textContent = '수정';
        editBtn.onclick = () => editTransaction(t.id);
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '삭제';
        deleteBtn.className = 'delete-btn';
        deleteBtn.onclick = () => deleteTransaction(t.id);
        buttonsDiv.appendChild(editBtn);
        buttonsDiv.appendChild(deleteBtn);
        listItem.appendChild(infoSpan);
        listItem.appendChild(buttonsDiv);
        listElement.appendChild(listItem);
    });
}

// --- 계산 로직 ---
function calculateResults(previewTransaction, isFinalCalculation) {
    let transactionsToCalculate = [...transactions]; 
    if (previewTransaction && !isFinalCalculation) { 
        transactionsToCalculate.push(previewTransaction); 
    }

    let totalBuyExecutionAmount = 0;
    let totalBuyQuantity = 0;
    let totalBuyFee = 0;
    let totalSellExecutionAmount = 0;
    let totalSellQuantity = 0;
    let totalSellFee = 0;

    transactionsToCalculate.forEach(t => {
        if (t.type === 'buy') {
            totalBuyExecutionAmount += t.executionAmount;
            totalBuyQuantity += t.quantity;
            totalBuyFee += t.fee;
        } else if (t.type === 'sell') {
            totalSellExecutionAmount += t.executionAmount;
            totalSellQuantity += t.quantity;
            totalSellFee += t.fee;
        }
    });

    const currentQuantityForDisplay = totalBuyQuantity - totalSellQuantity; 
    const totalAccumulatedFee = totalBuyFee + totalSellFee;
    
    // 실질 투자 원금 (회수 필요 금액) = (총 매수 체결금액 + 총 매수 수수료) - (총 매도 체결금액 - 총 매도 수수료)
    const netInvestmentWithFee = (totalBuyExecutionAmount + totalBuyFee) - (totalSellExecutionAmount - totalSellFee);
    
    let pureAvgPrice = 0;
    if (totalBuyQuantity > 0) { // 순수 매수 평단 (최초 매수들 기준)
        let pureTotalBuyAmount = 0;
        let pureTotalBuyQty = 0;
        transactionsToCalculate.filter(t => t.type === 'buy').forEach(buyTx => {
            pureTotalBuyAmount += buyTx.executionAmount;
            pureTotalBuyQty += buyTx.quantity;
        });
        if (pureTotalBuyQty > 0) {
            pureAvgPrice = pureTotalBuyAmount / pureTotalBuyQty;
        }
    }


    if (isFinalCalculation) {
        // 확정된 거래 기준으로 lastCalculated 값들 업데이트
        let finalBuyQty = 0; let finalSellQty = 0;
        let finalBuyExecAmt = 0; let finalSellExecAmt = 0;
        let finalBuyFee = 0; let finalSellFee = 0;

        transactions.forEach(t => { // 실제 저장된 거래만 사용
            if (t.type === 'buy') {
                finalBuyQty += t.quantity;
                finalBuyExecAmt += t.executionAmount;
                finalBuyFee += t.fee;
            } else {
                finalSellQty += t.quantity;
                finalSellExecAmt += t.executionAmount;
                finalSellFee += t.fee;
            }
        });
        lastCalculatedCurrentQuantity = finalBuyQty - finalSellQty;
        if (lastCalculatedCurrentQuantity > 0) {
            const finalNetInvestmentWithFee = (finalBuyExecAmt + finalBuyFee) - (finalSellExecAmt - finalSellFee);
            lastCalculatedBreakevenPriceWithFee = finalNetInvestmentWithFee / lastCalculatedCurrentQuantity;
        } else {
            lastCalculatedBreakevenPriceWithFee = null;
        }
    }

    // 화면 표시
    document.getElementById('total-buy-execution-amount').textContent = formatNumber(String(totalBuyExecutionAmount),2);
    document.getElementById('total-buy-quantity').textContent = formatNumber(String(totalBuyQuantity),8);
    document.getElementById('total-buy-fee').textContent = formatNumber(String(totalBuyFee),2);
    document.getElementById('total-sell-execution-amount').textContent = formatNumber(String(totalSellExecutionAmount),2);
    document.getElementById('total-sell-quantity').textContent = formatNumber(String(totalSellQuantity),8);
    document.getElementById('total-sell-fee').textContent = formatNumber(String(totalSellFee),2);
    
    document.getElementById('current-quantity').textContent = formatNumber(String(currentQuantityForDisplay),8);
    document.getElementById('pure-avg-price').textContent = formatNumber(String(pureAvgPrice), 2);
    document.getElementById('total-accumulated-fee').textContent = formatNumber(String(totalAccumulatedFee),2);
    document.getElementById('net-investment-with-fee').textContent = formatNumber(String(netInvestmentWithFee),2);


    const breakevenEl = document.getElementById('breakeven-price-with-fee');
    const applyBtn = document.getElementById('apply-new-start-btn');

    if (isFinalCalculation) {
        if(applyBtn) {
            applyBtn.disabled = !(lastCalculatedCurrentQuantity > 0 && lastCalculatedBreakevenPriceWithFee !== null && !isNaN(lastCalculatedBreakevenPriceWithFee));
        }
    } else {
        if (applyBtn && currentQuantityForDisplay <= 0) {
            applyBtn.disabled = true;
        }
    }

    if (currentQuantityForDisplay < 0) {
        breakevenEl.textContent = "오류: 매도량이 매수량보다 많습니다.";
        breakevenEl.style.color = "red";
    } else if (currentQuantityForDisplay > 0) {
        const breakevenPriceVal = netInvestmentWithFee / currentQuantityForDisplay;
        breakevenEl.textContent = formatNumber(String(breakevenPriceVal), 8) + "원";
        breakevenEl.style.color = "#d9534f";
    } else { 
        breakevenEl.textContent = "보유 주식 없음"; // 또는 최종 손익 표시
        if (netInvestmentWithFee < 0) { // 총 비용이 더 큼 (최종적으로 돈을 잃음)
            breakevenEl.textContent = `전량 매도 (최종 손실: ${formatNumber(String(Math.abs(netInvestmentWithFee)),2)}원)`;
            breakevenEl.style.color = "blue";
        } else if (netInvestmentWithFee > 0) { // 총 수익이 더 큼 (최종적으로 돈을 범)
             breakevenEl.textContent = `전량 매도 (최종 이익: ${formatNumber(String(netInvestmentWithFee),2)}원)`;
             breakevenEl.style.color = "green";
        } else { // 0
             breakevenEl.textContent = "전량 매도 (본전)";
             breakevenEl.style.color = "black";
        }
    }
}

function applyResultsAsNewStart() {
    if (lastCalculatedCurrentQuantity <= 0 || lastCalculatedBreakevenPriceWithFee === null || isNaN(lastCalculatedBreakevenPriceWithFee)) {
        alert("새 시작점으로 적용할 유효한 보유 수량과 원금 회복 단가(수수료 포함)가 없습니다.");
        return;
    }
    const confirmation = confirm(
        `기존 모든 거래 내역이 삭제되고, 아래의 상태를 새로운 매수 내역으로 설정합니다:\n\n` +
        `수량: ${formatNumber(String(lastCalculatedCurrentQuantity),8)}\n` +
        `단가 (수수료 포함된 실질 평단가): ${formatNumber(String(lastCalculatedBreakevenPriceWithFee),8)}원\n\n` +
        `이 단가에는 이미 과거 수수료 비용이 반영되어 있습니다. 계속하시겠습니까?`
    );
    if (confirmation) {
        // 새 시작점의 매수 거래는 '수수료가 이미 포함된 단가'로 매수한 것으로 간주
        // 따라서 이 새 거래 자체의 수수료는 0으로 처리.
        transactions = [{
            type: 'buy',
            quantity: lastCalculatedCurrentQuantity,
            price: lastCalculatedBreakevenPriceWithFee, // 수수료 포함 평단가를 새 체결가로
            executionAmount: lastCalculatedCurrentQuantity * lastCalculatedBreakevenPriceWithFee,
            fee: 0, // 이 거래 자체의 추가 수수료는 없음 (이미 평단가에 녹아있음)
            id: Date.now()
        }];
        renderTransactionList();
        calculateResults(null, true); 
        alert("현재 결과가 새로운 시작점으로 적용되었습니다.");
        
        ['price', 'quantity', 'total-amount'].forEach(id => {
            const el = document.getElementById(id);
            el.value = '';
            delete el.dataset.raw_value;
        });
        runSimulation(); 
    }
}

function resetCalculator() {
    transactions = [];
    lastCalculatedBreakevenPriceWithFee = null;
    lastCalculatedCurrentQuantity = 0;
    renderTransactionList();
    
    // 결과 필드 ID 목록화하여 초기화
    const resultSpans = [
        'total-buy-execution-amount', 'total-buy-quantity', 'total-buy-fee',
        'total-sell-execution-amount', 'total-sell-quantity', 'total-sell-fee',
        'current-quantity', 'pure-avg-price', 'total-accumulated-fee', 
        'net-investment-with-fee'
    ];
    resultSpans.forEach(id => document.getElementById(id).textContent = '0');
    document.getElementById('breakeven-price-with-fee').textContent = '계산 필요';
    document.getElementById('breakeven-price-with-fee').style.color = "#d9534f";

    ['price', 'quantity', 'total-amount'].forEach(id => {
        const el = document.getElementById(id);
        el.value = '';
        delete el.dataset.raw_value;
    });
    // 수수료율은 기본값으로 유지하거나 초기화 (여기선 유지)
    // document.getElementById('buy-fee-rate').value = "0.05";
    // document.getElementById('sell-fee-rate').value = "0.05";
    // buyFeeRate = 0.0005; sellFeeRate = 0.0005;


    const applyBtn = document.getElementById('apply-new-start-btn');
    if(applyBtn) applyBtn.disabled = true;
    runSimulation();
}

// --- 페이지 로드 시 초기화 ---
document.addEventListener('DOMContentLoaded', () => {
    // 초기 수수료율 설정
    buyFeeRate = parseFormattedNumber(document.getElementById('buy-fee-rate').value) / 100;
    sellFeeRate = parseFormattedNumber(document.getElementById('sell-fee-rate').value) / 100;

    const applyBtn = document.getElementById('apply-new-start-btn');
    if(applyBtn) applyBtn.disabled = true; 
    runSimulation(); // 초기 상태에 대한 계산 실행
});