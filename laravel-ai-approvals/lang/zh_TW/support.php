<?php

// 範例的所有文案。新增語言時，複製這個檔案到 lang/<locale>/support.php。
return [
    'app_name' => 'Hibira Agent Approvals Demo',
    'conversation_title' => '訂單 :order 客服',
    'approval_reason' => '所有退款都需要主管審批。',
    'no_orders' => '你目前沒有訂單。',
    'busy' => '客服正在處理上一則訊息，請等它完成。',

    'auth' => [
        'title' => '登入',
        'email' => '電子郵件',
        'password' => '密碼',
        'submit' => '登入',
        'failed' => '帳號或密碼不正確。',
        'logout' => '登出',
        'demo_title' => '示範帳號（DEMO_MODE）',
        'demo_hint' => '只在本機示範模式顯示。正式部署請關閉 DEMO_MODE。',
        'roles' => [
            'customer' => '客戶',
            'approver' => '主管／審批者',
            'none' => '無權限使用者',
        ],
        'forbidden_title' => '沒有權限',
        'forbidden_body' => '這個帳號沒有客戶或審批者的權限。',
    ],

    'page' => [
        'title' => '客服',
        'order' => '訂單',
        'paid' => '已付款',
        'refunded' => '已退款',
        'refundable' => '可退款',
        'refunds' => '退款紀錄',
        'no_refunds' => '尚無退款。',
        'chat' => '與客服對話',
        'placeholder' => '例如：我想退掉這筆訂單',
        'send' => '送出',
        'you' => '你',
        'agent' => '客服 AI',
        'notice' => '系統',
        'empty' => '有任何問題都可以問，例如退款。',
        'streaming' => '正在回覆…',
        'resync' => '回覆內容不完整，正在從伺服器重新同步…',
        'decided_by' => ':name 決定',
        'requested' => '申請 :amount',
        'final' => '實際 :amount',
    ],

    // 連線與流程狀態：畫面上方的狀態列。
    'connection' => [
        'connecting' => '連線中…',
        'connected' => '即時連線',
        'reconnecting' => '連線中斷，正在重新連線…',
        'offline' => '目前離線，恢復連線後會自動更新',
        'unavailable' => '無法連上即時服務，畫面每 15 秒重新整理狀態',
    ],

    'status' => [
        'idle' => '可以提問',
        'thinking' => '客服 AI 正在處理…',
        'awaiting_approval' => '等待主管審批',
        'resuming' => '主管已決定，客服 AI 正在繼續…',
        'completed' => '已完成',
        'rejected' => '已拒絕',
        'failed' => '處理失敗',
    ],

    'status_detail' => [
        'awaiting_approval' => '退款申請已送給主管。你可以關閉這個頁面，結果會保存在這裡。',
        'resuming' => '正在依主管的決定處理退款。',
        'completed' => '退款已完成（示範環境的模擬退款，沒有實際金流）。',
        'rejected' => '主管沒有核准這筆退款。',
    ],

    'errors' => [
        'agent_failed' => '客服 AI 暫時無法回覆。你的訊息已保存，請稍後再傳一次。',
        'resume_failed' => '主管已決定，但處理時發生錯誤。決定與資料都已保存，主管可以在審批收件匣重試，不會重複退款。',
        'worker_interrupted' => '處理被中斷（背景工作程序停止）。資料都已保存，可以重試，不會重複退款。',
        'refund_invalid' => '退款沒有執行：核准的金額或訂單不符合規則。',
        'network' => '無法連上伺服器，請檢查網路後再試。',
        'unknown' => '發生錯誤，請稍後再試。',
    ],

    // 系統依保存的資料補上的訊息（例如重試時 agent 已無法再回覆）。
    'notice' => [
        'refunded' => '退款已完成：訂單 :order 退款 :amount（退款編號 :reference）。',
        'not_refunded' => '這筆退款沒有執行。',
    ],

    'operation_status' => [
        'awaiting_decision' => '等待審批',
        'approved' => '已核准，處理中',
        'rejected' => '已拒絕',
        'completed' => '已退款',
        'invalid' => '未執行（參數無效）',
    ],

    'invalid' => [
        'order' => '訂單不符：只能退這個對話的訂單。',
        'currency' => '幣別不符：這個範例只接受 USD。',
        'not_integer' => '金額必須是整數（以分為單位，例如 2900 = USD 29.00）。',
        'not_positive' => '金額必須大於 0。',
        'too_much' => '金額超過可退款金額 :refundable。',
        'rejected' => '這筆退款已被拒絕。',
        'no_approval' => '找不到這筆退款的審批紀錄。',
        'no_case' => '找不到這個請求對應的客服案件，請稍後再試。',
    ],

    'inbox' => [
        'invalid_title' => '沒有儲存這個決定',
        'taken_title' => '其他主管已先決定',
        'taken_body' => ':name 已經決定了這筆呼叫。要改變，請先撤銷。',
        'worker_interrupted' => '背景工作程序在處理時停止。資料已保存，可以按「重試」，同一筆退款不會重複執行。',
    ],

    'admin' => [
        'operation' => '退款操作',
        'operations' => '退款操作',
        'order' => '訂單',
        'orders' => '訂單',
        'customer' => '客戶',
        'item' => '商品',
        'paid' => '已付',
        'refunded' => '已退',
        'refundable' => '可退',
        'requested' => 'Agent 申請',
        'final' => '實際金額',
        'status' => '狀態',
        'decided_by' => '決定者',
        'note' => '理由／說明',
        'reference' => '退款編號',
        'operation_id' => '操作 ID',
        'created' => '建立',
        'context_heading' => '待審退款的訂單',
        'context_description' => '金額以後端資料為準；修改時請輸入以分為單位的整數。',
        'amount_hint' => '例：USD 29.00 → "amount": 2900',
    ],

    // Mock 模式的「模型」輸出。
    'mock' => [
        'greeting' => '您好，我是客服 AI。如果需要退款，請告訴我，例如「我想退掉這筆訂單」。',
        'nothing_to_refund' => '我查了您的訂單，目前沒有可以退款的金額。',
        'refund_reason' => '客戶要求退掉整筆訂單，訂單可退金額 :amount。',
        'asking_manager' => '我查到訂單 :order，可退款 :amount。退款需要主管審批，我已經送出申請，結果出來會在這裡通知您。',
        'refunded' => '主管已核准，訂單 :order 已退款 :amount（退款編號 :reference）。這是示範環境的模擬退款，不會有實際款項移動。',
        'rejected' => '很抱歉，主管沒有核准這筆退款。主管的說明：「:reason」。如果有其他問題，歡迎再告訴我。',
        'rejected_no_reason' => '很抱歉，主管沒有核准這筆退款。如果有其他問題，歡迎再告訴我。',
        'invalid' => '退款沒有執行：:error 我會請主管再確認。',
        'unknown' => '退款處理的結果不明確，我會請主管確認。',
    ],
];
