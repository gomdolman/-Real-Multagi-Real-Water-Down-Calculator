let transactions = [];
let lastCalculatedBreakevenPriceWithFee = null; 
let lastCalculatedCurrentQuantity = 0;
let isCalculating = false; 

let buyFeeRate = 0.0005; 
let sellFeeRate = 0.0005; 

// --- 유틸리티 함수 ---
function formatNumber(numStr, maxDecimals = 8, minDecimals = 0) {
    if (numStr === null || numStr === undefined || String(numStr).trim() === '' || isNaN(parseFloat(String(numStr)))) return '0'; 
    const num = parseFloat(String(numStr));
    return num.toLocaleString(undefined, {
        minimumFractionDigits: minDecimals,
        maximumFractionDigits: maxDecimals
    });
}

function parseFormattedNumber(formattedStr) {
    if (formattedStr === null || formattedStr === undefined || String(formattedStr).trim() === '') return 0;
    const num = parseFloat(String(formattedStr).replace(/[^0-9.-]/g, '')); 
    return isNaN(num) ? 0 : num;
}

function handleRawInput(inputElement, isFeeRate = false) {
    let value = inputElement.value;
    let numericValue = value.replace(isFeeRate ? /[^0-9.]/g : /[^0-9.]/g, ''); 
    
    const parts = numericValue.split('.');
    if (parts.length > 2) { 
        numericValue = parts[0] + '.' + parts.slice(1).join('');
    }
    inputElement.dataset.raw_value = numericValue;

    if (numericValue) {
        const [integerPart, decimalPart] = numericValue.split('.');
        const intPartForLocale = (integerPart === "" && decimalPart !== undefined) ? "0" : integerPart;
        const formattedInteger = (intPartForLocale && intPartForLocale !== "") ? parseFloat(intPartForLocale).toLocaleString('ko-KR', {maximumFractionDigits: 5}) : (integerPart === "" ? "" : "0");
        inputElement.value = decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger;
    } else if (value !== "" && value !== "-") { 
        inputElement.value = '';
    }
}

// --- 수수료율 처리 ---
function handleFeeRateInput(inputElement) {
    handleRawInput(inputElement, true); 
    const value = parseFormattedNumber(inputElement.dataset.raw_value || inputElement.value);
    const rate = value / 100; 

    if (inputElement.id === 'buy-fee-rate') {
        buyFeeRate = isNaN(rate) ? 0 : rate;
    } else if (inputElement.id === 'sell-fee-rate') {
        sellFeeRate = isNaN(rate) ? 0 : rate;
    }
}

// --- 입력 필드 하이라이트 함수 ---
function highlightField(element) {
    if (!element) return;
    element.classList.add('input-highlight');
    setTimeout(() => {
        element.classList.remove('input-highlight');
    }, 700); 
}

// --- 입력 필드 연동 및 실시간 시뮬레이션 ---
function handleInputChange(changedField) {
    if (isCalculating) return; 
    isCalculating = true;

    const priceInput = document.getElementById('price');
    const quantityInput = document.getElementById('quantity');
    const totalAmountInput = document.getElementById('total-amount');

    handleRawInput(priceInput); 
    handleRawInput(quantityInput);
    handleRawInput(totalAmountInput);

    let price = parseFormattedNumber(priceInput.dataset.raw_value);
    let quantity = parseFormattedNumber(quantityInput.dataset.raw_value);
    let totalAmount = parseFormattedNumber(totalAmountInput.dataset.raw_value);
    
    let autoCalculatedField = null;

    if (changedField === 'price' || changedField === 'quantity') {
        if (price > 0 && quantity > 0) {
            const newTotalAmount = price * quantity;
            if (Math.abs(parseFormattedNumber(totalAmountInput.value) - newTotalAmount) > 0.00000001 || totalAmountInput.value === '') {
                totalAmountInput.value = formatNumber(String(newTotalAmount), 2); 
                totalAmountInput.dataset.raw_value = String(newTotalAmount); 
                handleRawInput(totalAmountInput); 
                autoCalculatedField = totalAmountInput;
            }
        } else if (totalAmountInput.value !== '') { 
            totalAmountInput.value = ''; 
            delete totalAmountInput.dataset.raw_value;
        }
    } else if (changedField === 'total-amount') {
        if (price > 0 && totalAmount > 0) {
            const newQuantity = totalAmount / price;
            if (Math.abs(parseFormattedNumber(quantityInput.value) - newQuantity) > 0.000000001 || quantityInput.value === '') {
                quantityInput.value = formatNumber(String(newQuantity), 8);
                quantityInput.dataset.raw_value = String(newQuantity);
                handleRawInput(quantityInput); 
                autoCalculatedField = quantityInput;
            }
        } else if (quantityInput.value !== '') { 
             quantityInput.value = ''; 
             delete quantityInput.dataset.raw_value;
        }
    }
    
    if (autoCalculatedField) {
        highlightField(autoCalculatedField);
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
        } else { 
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
    const price = getNumericInputValue('price'); 

    if (quantity <= 0 || price <= 0) {
        alert('유효한 수량과 단가를 입력해주세요 (0보다 커야 합니다).');
        return;
    }

    const executionAmount = price * quantity;
    let fee = 0;
    if (type === 'buy') {
        fee = executionAmount * buyFeeRate;
    } else { 
        fee = executionAmount * sellFeeRate;
    }

    transactions.push({ type, quantity, price, executionAmount, fee, id: Date.now() });
    renderTransactionList();
    calculateResults(null, true); 

    document.getElementById('price').value = '';
    document.getElementById('quantity').value = '';
    document.getElementById('total-amount').value = '';
    
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
    } else { 
        newFee = newExecutionAmount * sellFeeRate;
    }

    transactions[transactionIndex] = {
        ...oldTransaction, 
        quantity: newQuantity,
        price: newPrice,
        executionAmount: newExecutionAmount,
        fee: newFee
    };
    renderTransactionList();
    calculateResults(null, true); 
}

function deleteTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    renderTransactionList();
    calculateResults(null, true); 
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
    const netInvestmentWithFee = (totalBuyExecutionAmount + totalBuyFee) - (totalSellExecutionAmount - totalSellFee);
    
    let pureAvgPrice = 0;
    if (totalBuyQuantity > 0) { 
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
        let finalBuyQty = 0; let finalSellQty = 0;
        let finalBuyExecAmt = 0; let finalSellExecAmt = 0;
        let finalBuyFee = 0; let finalSellFee = 0;
        transactions.forEach(t => { 
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
            // "새 시작점"을 위한 평단가는 이미 이익이 실현된 경우 0 또는 매우 낮은 값으로 처리할 수 있음
            if (finalNetInvestmentWithFee < 0) {
                lastCalculatedBreakevenPriceWithFee = 0; // 또는 다른 적절한 값
            } else {
                lastCalculatedBreakevenPriceWithFee = finalNetInvestmentWithFee / lastCalculatedCurrentQuantity;
            }
        } else {
            lastCalculatedBreakevenPriceWithFee = null;
        }
    }

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

    // ▼▼▼ 여기가 수정된 부분입니다 ▼▼▼
    if (currentQuantityForDisplay < 0) {
        breakevenEl.textContent = "오류: 매도량이 매수량보다 많습니다.";
        breakevenEl.style.color = "red";
    } else if (currentQuantityForDisplay > 0) {
        // netInvestmentWithFee가 음수 = 이미 이익 실현된 상태에서 주식 보유 중
        if (netInvestmentWithFee < 0) {
            breakevenEl.textContent = `이미 ${formatNumber(String(Math.abs(netInvestmentWithFee)), 2)}원 이익! (남은 주식 평단가는 사실상 0 이하)`;
            breakevenEl.style.color = "green"; // 이익이므로 초록색
        } else { // netInvestmentWithFee >= 0 (본전 또는 아직 손실 회수 필요)
            const breakevenPriceVal = netInvestmentWithFee / currentQuantityForDisplay;
            breakevenEl.textContent = formatNumber(String(breakevenPriceVal), 8) + "원";
            breakevenEl.style.color = "#d9534f"; // 손익분기점 단가 표시 색상
        }
    } else { // currentQuantityForDisplay === 0 (전량 매도 시)
        breakevenEl.textContent = "보유 주식 없음"; 
        if (netInvestmentWithFee < 0) { 
            breakevenEl.textContent = `전량 매도 (최종 이익: ${formatNumber(String(Math.abs(netInvestmentWithFee)),2)}원)`;
            breakevenEl.style.color = "green"; 
        } else if (netInvestmentWithFee > 0) { 
             breakevenEl.textContent = `전량 매도 (최종 손실: ${formatNumber(String(netInvestmentWithFee),2)}원)`;
             breakevenEl.style.color = "blue"; 
        } else { 
             breakevenEl.textContent = "전량 매도 (본전)";
             breakevenEl.style.color = "black"; 
        }
    }
    // ▲▲▲ 여기가 수정된 부분입니다 ▲▲▲
}

function applyResultsAsNewStart() {
    // lastCalculatedBreakevenPriceWithFee가 0인 경우(이미 이익 실현 후 새 시작점)도 유효하게 처리
    if (lastCalculatedCurrentQuantity <= 0 || lastCalculatedBreakevenPriceWithFee === null || isNaN(lastCalculatedBreakevenPriceWithFee)) {
        alert("새 시작점으로 적용할 유효한 보유 수량과 원금 회복 단가(수수료 포함)가 없습니다.");
        return;
    }
    const confirmation = confirm(
        `기존 모든 거래 내역이 삭제되고, 아래의 상태를 새로운 매수 내역으로 설정합니다:\n\n` +
        `수량: ${formatNumber(String(lastCalculatedCurrentQuantity),8)}\n` +
        `단가 (실질 평단가): ${formatNumber(String(lastCalculatedBreakevenPriceWithFee),8)}원\n\n` +
        `이 단가에는 이미 과거 수수료 비용이 반영되어 있습니다 (이미 이익 실현 시 0으로 표시될 수 있음). 계속하시겠습니까?`
    );
    if (confirmation) {
        transactions = [{
            type: 'buy',
            quantity: lastCalculatedCurrentQuantity,
            price: lastCalculatedBreakevenPriceWithFee, 
            executionAmount: lastCalculatedCurrentQuantity * lastCalculatedBreakevenPriceWithFee,
            fee: 0, 
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

    const applyBtn = document.getElementById('apply-new-start-btn');
    if(applyBtn) applyBtn.disabled = true;
    runSimulation();
}

// --- 페이지 로드 시 초기화 ---
document.addEventListener('DOMContentLoaded', () => {
    buyFeeRate = parseFormattedNumber(document.getElementById('buy-fee-rate').value) / 100;
    sellFeeRate = parseFormattedNumber(document.getElementById('sell-fee-rate').value) / 100;

    const applyBtn = document.getElementById('apply-new-start-btn');
    if(applyBtn) applyBtn.disabled = true; 
    runSimulation(); 
});