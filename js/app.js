const App = {
  state: {
    currentTab: 'home',
    orderFilter: 'all',
    orders: [],
    user: { name: '同学', dorm: '未设置', phone: '' },
    nextId: 1
  },

  config: {
    couriers: ['顺丰', '圆通', '中通', '韵达', '申通', '邮政', '京东', '极兔', '其他'],
    sizes: [
      { id: 'small', label: '小件', fee: 2 },
      { id: 'medium', label: '中件', fee: 3 },
      { id: 'large', label: '大件', fee: 5 },
      { id: 'xlarge', label: '超大', fee: '面议' }
    ],
    statusMap: {
      pending: '待取件', picked_up: '已取件',
      delivering: '配送中', delivered: '已送达', cancelled: '已取消'
    },
    statusFlow: ['pending', 'picked_up', 'delivering', 'delivered']
  },

  init() {
    this.loadState(); this.render(); this.bindEvents();
    this.switchTab('home'); this.updateStats();
  },

  loadState() {
    try {
      const saved = localStorage.getItem('lxq_state');
      if (saved) {
        const p = JSON.parse(saved);
        this.state.orders = p.orders || [];
        this.state.user = { ...this.state.user, ...(p.user || {}) };
        this.state.nextId = p.nextId || 1;
      }
    } catch(e) {}
  },

  saveState() {
    localStorage.setItem('lxq_state', JSON.stringify({
      orders: this.state.orders, user: this.state.user, nextId: this.state.nextId
    }));
  },

  genId() {
    const pad = String(this.state.nextId).padStart(4, '0');
    this.state.nextId++; this.saveState();
    return 'LX' + pad;
  },

  now() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  },

  toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
  },

  switchTab(tab) {
    this.state.currentTab = tab;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    const page = document.getElementById('page-' + tab);
    const tabEl = document.querySelector('[data-tab="' + tab + '"]');
    if (page) page.classList.add('active');
    if (tabEl) tabEl.classList.add('active');
    if (tab === 'orders') this.renderOrders();
    if (tab === 'profile') this.renderProfile();
    document.querySelector('.main-content').scrollTop = 0;
  },

  updateStats() {
    const o = this.state.orders;
    document.getElementById('stat-total').textContent = o.filter(x => x.status !== 'cancelled').length;
    document.getElementById('stat-delivered').textContent = o.filter(x => x.status === 'delivered').length;
    document.getElementById('stat-active').textContent = o.filter(x => ['pending','picked_up','delivering'].includes(x.status)).length;
  },

  renderOrderForm() {
    document.getElementById('order-form').innerHTML =
      '<div class="form-group"><label class="form-label">快递公司 <span class="required">*</span></label><select id="field-courier" class="form-select"><option value="">请选择快递公司</option>' +
      this.config.couriers.map(c => '<option value="' + c + '">' + c + '</option>').join('') +
      '</select></div>' +
      '<div class="form-group"><label class="form-label">快递单号 <span class="required">*</span></label><input id="field-tracking" class="form-input" type="text" placeholder="请输入快递单号" /></div>' +
      '<div class="form-group"><label class="form-label">取件地点 <span class="required">*</span></label><input id="field-pickup" class="form-input" type="text" placeholder="如：菜鸟驿站、校门口、丰巢" /></div>' +
      '<div class="form-group"><label class="form-label">送至地址 <span class="required">*</span></label><input id="field-address" class="form-input" type="text" placeholder="如：X栋XXX室" /></div>' +
      '<div class="form-group"><label class="form-label">收件人 <span class="required">*</span></label><input id="field-name" class="form-input" type="text" placeholder="您的称呼" /></div>' +
      '<div class="form-group"><label class="form-label">手机号</label><input id="field-phone" class="form-input" type="tel" placeholder="手机号（可选）" /></div>' +
      '<div class="form-group"><label class="form-label">包裹大小 <span class="required">*</span></label><div class="radio-group">' +
      this.config.sizes.map((s, i) =>
        '<label class="radio-label"><input type="radio" name="size" value="' + s.id + '"' + (i===0?' checked':'') + '/>' +
        s.label + ' <span class="radio-fee">' + (typeof s.fee==='number' ? '¥'+s.fee : s.fee) + '</span></label>'
      ).join('') +
      '</div></div>' +
      '<div class="form-group"><label class="form-label">备注</label><textarea id="field-note" class="form-textarea" placeholder="有什么需要特殊说明的？如：易碎品、晚上配送等"></textarea></div>' +
      '<button id="btn-submit" class="btn btn-primary">提交订单</button>';
  },

  submitOrder() {
    const courier = document.getElementById('field-courier').value.trim();
    const tracking = document.getElementById('field-tracking').value.trim();
    const pickup = document.getElementById('field-pickup').value.trim();
    const address = document.getElementById('field-address').value.trim();
    const name = document.getElementById('field-name').value.trim();
    const phone = document.getElementById('field-phone').value.trim();
    const sizeRadio = document.querySelector('input[name="size"]:checked');
    const size = sizeRadio ? sizeRadio.value : 'small';
    const note = document.getElementById('field-note').value.trim();
    if (!courier) { this.toast('请选择快递公司'); return; }
    if (!tracking) { this.toast('请输入快递单号'); return; }
    if (!pickup) { this.toast('请输入取件地点'); return; }
    if (!address) { this.toast('请输入送至地址'); return; }
    if (!name) { this.toast('请输入收件人'); return; }
    const sc = this.config.sizes.find(s => s.id === size);
    const fee = sc && typeof sc.fee === 'number' ? sc.fee : '面议';
    this.state.orders.unshift({
      id: this.genId(), courier, tracking, pickup, address, name, phone,
      size: sc ? sc.label : '小件', fee, note,
      status: 'pending', createdAt: this.now(), updatedAt: this.now(),
      timeline: [{ status: 'pending', title: '订单已提交', time: this.now() }]
    });
    this.saveState(); this.updateStats();
    this.toast('下单成功！等待配送员接单');
    document.querySelectorAll('#order-form input, #order-form textarea, #order-form select').forEach(el => {
      if (el.type !== 'radio' && el.type !== 'submit') el.value = '';
    });
    const fr = document.querySelector('input[name="size"]');
    if (fr) fr.checked = true;
  },

  renderOrders() {
    const container = document.getElementById('order-list');
    const filter = this.state.orderFilter;
    let filtered = filter === 'all' ? this.state.orders : this.state.orders.filter(o => o.status === filter);
    const sl = this.config.statusMap;
    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state fade-in"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg><p>' + (filter === 'all' ? '还没有订单，快去下单吧' : '没有符合条件的订单') + '</p></div>';
      return;
    }
    container.innerHTML = filtered.map(o =>
      '<div class="order-card fade-in" data-order-id="' + o.id + '" onclick="App.showOrderDetail(\'' + o.id + '\')">' +
        '<div class="order-card-header"><span class="order-id">' + o.id + '</span><span class="order-status ' + o.status + '">' + sl[o.status] + '</span></div>' +
        '<div class="order-card-body">' +
          '<div class="info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg><span class="tracking-num">' + o.tracking + '</span><span style="color:var(--gray-400);font-size:12px">' + o.courier + '</span></div>' +
          '<div class="info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg><span>' + o.pickup + ' → ' + o.address + '</span></div>' +
        '</div>' +
        '<div class="order-card-footer"><span>' + o.createdAt + '</span><span class="order-fee">' + (typeof o.fee === 'number' ? '¥' + o.fee : o.fee) + '</span></div>' +
      '</div>'
    ).join('');
  },

  setOrderFilter(filter) {
    this.state.orderFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
    this.renderOrders();
  },

  showOrderDetail(orderId) {
    const order = this.state.orders.find(o => o.id === orderId);
    if (!order) return;
    const sl = this.config.statusMap;
    const modal = document.getElementById('detail-modal');
    const sheet = modal.querySelector('.modal-sheet');
    const sc = this.config.sizes.find(s => s.label === order.size);
    const sf = sc && typeof sc.fee === 'number' ? '¥' + sc.fee : order.fee;
    const flow = [
      { status: 'pending', title: '订单已提交' },
      { status: 'picked_up', title: '快递已取件' },
      { status: 'delivering', title: '配送中' },
      { status: 'delivered', title: '已送达' }
    ];
    let tl = '';
    if (order.status === 'cancelled') {
      const ce = order.timeline.find(t => t.status === 'cancelled');
      flow.forEach(s => {
        const done = order.timeline.find(t => t.status === s.status);
        tl += '<div class="timeline-item"><div class="timeline-dot ' + (done ? 'success' : 'inactive') + '"></div><div class="timeline-content"><div class="tl-title" style="color:' + (done ? 'var(--gray-700)' : 'var(--gray-300)') + '">' + s.title + '</div>' + (done ? '<div class="tl-time">' + done.time + '</div>' : '') + '</div></div>';
      });
      tl += '<div class="timeline-item"><div class="timeline-dot" style="background:var(--danger);box-shadow:0 0 0 3px rgba(239,68,68,0.2)"></div><div class="timeline-content"><div class="tl-title" style="color:var(--danger)">订单已取消</div>' + (ce ? '<div class="tl-time">' + ce.time + '</div>' : '') + '</div></div>';
    } else {
      flow.forEach(s => {
        const done = order.timeline.find(t => t.status === s.status);
        const isAct = s.status === order.status;
        tl += '<div class="timeline-item"><div class="timeline-dot ' + (done ? 'success' : isAct ? 'active' : 'inactive') + '"></div><div class="timeline-content"><div class="tl-title" style="color:' + (done || isAct ? 'var(--gray-700)' : 'var(--gray-300)') + '">' + s.title + '</div>' + (done ? '<div class="tl-time">' + done.time + '</div>' : isAct ? '<div class="tl-time" style="color:var(--primary)">进行中</div>' : '') + '</div></div>';
      });
    }
    let actions = '';
    if (order.status === 'pending') actions += '<button class="btn btn-danger btn-sm" onclick="App.cancelOrder(\'' + order.id + '\')">取消订单</button><button class="btn btn-success btn-sm" onclick="App.updateOrderStatus(\'' + order.id + '\',\'picked_up\')">标记已取件</button>';
    else if (order.status === 'picked_up') actions += '<button class="btn btn-primary btn-sm" onclick="App.updateOrderStatus(\'' + order.id + '\',\'delivering\')">开始配送</button>';
    else if (order.status === 'delivering') actions += '<button class="btn btn-success btn-sm" onclick="App.updateOrderStatus(\'' + order.id + '\',\'delivered\')">确认送达</button>';
    sheet.innerHTML =
      '<div class="modal-handle"></div><div class="modal-title">订单详情</div>' +
      '<div class="detail-row"><span class="detail-label">订单编号</span><span class="detail-value" style="font-family:monospace">' + order.id + '</span></div>' +
      '<div class="detail-row"><span class="detail-label">当前状态</span><span class="detail-value"><span class="order-status ' + order.status + '">' + sl[order.status] + '</span></span></div>' +
      '<div class="detail-row"><span class="detail-label">快递公司</span><span class="detail-value">' + order.courier + '</span></div>' +
      '<div class="detail-row"><span class="detail-label">快递单号</span><span class="detail-value" style="font-family:monospace;font-size:13px">' + order.tracking + '</span></div>' +
      '<div class="detail-row"><span class="detail-label">取件地点</span><span class="detail-value">' + order.pickup + '</span></div>' +
      '<div class="detail-row"><span class="detail-label">送至地址</span><span class="detail-value">' + order.address + '</span></div>' +
      '<div class="detail-row"><span class="detail-label">收件人</span><span class="detail-value">' + order.name + '</span></div>' +
      (order.phone ? '<div class="detail-row"><span class="detail-label">手机号</span><span class="detail-value">' + order.phone + '</span></div>' : '') +
      '<div class="detail-row"><span class="detail-label">包裹大小</span><span class="detail-value">' + order.size + '</span></div>' +
      '<div class="detail-row"><span class="detail-label">费用</span><span class="detail-value" style="color:var(--danger);font-weight:600">' + sf + '</span></div>' +
      (order.note ? '<div class="detail-row"><span class="detail-label">备注</span><span class="detail-value">' + order.note + '</span></div>' : '') +
      '<div class="detail-row"><span class="detail-label">下单时间</span><span class="detail-value">' + order.createdAt + '</span></div>' +
      '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--gray-100)"><div style="font-size:14px;font-weight:500;color:var(--gray-700);margin-bottom:8px">配送进度</div><div class="timeline">' + tl + '</div></div>' +
      (actions ? '<div class="modal-actions">' + actions + '</div>' : '');
    modal.classList.add('open');
  },

  closeDetail() { document.getElementById('detail-modal').classList.remove('open'); },

  cancelOrder(orderId) {
    if (!confirm('确定要取消这个订单吗？')) return;
    const order = this.state.orders.find(o => o.id === orderId);
    if (!order) return;
    order.status = 'cancelled'; order.updatedAt = this.now();
    order.timeline.push({ status: 'cancelled', title: '订单已取消', time: this.now() });
    this.saveState(); this.updateStats(); this.showOrderDetail(orderId); this.renderOrders();
    this.toast('订单已取消');
  },

  updateOrderStatus(orderId, newStatus) {
    const order = this.state.orders.find(o => o.id === orderId);
    if (!order) return;
    order.status = newStatus; order.updatedAt = this.now();
    order.timeline.push({ status: newStatus, title: this.config.statusMap[newStatus], time: this.now() });
    this.saveState(); this.updateStats(); this.showOrderDetail(orderId); this.renderOrders();
  },

  renderProfile() {
    const u = this.state.user;
    const o = this.state.orders;
    document.getElementById('profile-avatar').textContent = u.name.charAt(0);
    document.getElementById('profile-name').textContent = u.name;
    document.getElementById('profile-dorm').textContent = u.dorm ? u.dorm : '未设置宿舍';
    document.getElementById('profile-phone').textContent = u.phone || '未绑定手机';
    document.getElementById('stat-total-orders').textContent = o.length;
    document.getElementById('stat-delivered-orders').textContent = o.filter(x => x.status === 'delivered').length;
    document.getElementById('stat-active-orders').textContent = o.filter(x => ['pending','picked_up','delivering'].includes(x.status)).length;
  },

  showEditProfile() {
    const u = this.state.user;
    const modal = document.getElementById('edit-modal');
    const sheet = modal.querySelector('.modal-sheet');
    sheet.innerHTML =
      '<div class="modal-handle"></div><div class="modal-title">编辑资料</div><div class="edit-form">' +
      '<div class="form-group"><label class="form-label">昵称</label><input id="edit-name" class="form-input" value="' + u.name + '" placeholder="你的称呼" /></div>' +
      '<div class="form-group"><label class="form-label">宿舍</label><input id="edit-dorm" class="form-input" value="' + u.dorm + '" placeholder="如：X栋XXX室" /></div>' +
      '<div class="form-group"><label class="form-label">手机号</label><input id="edit-phone" class="form-input" value="' + u.phone + '" type="tel" placeholder="手机号码" /></div>' +
      '<button class="btn btn-primary" onclick="App.saveProfile()">保存</button></div>';
    modal.classList.add('open');
  },

  saveProfile() {
    this.state.user.name = document.getElementById('edit-name').value.trim() || '同学';
    this.state.user.dorm = document.getElementById('edit-dorm').value.trim();
    this.state.user.phone = document.getElementById('edit-phone').value.trim();
    this.saveState(); this.closeEdit(); this.renderProfile();
    this.toast('资料已保存');
  },

  closeEdit() { document.getElementById('edit-modal').classList.remove('open'); },

  render() { this.renderOrderForm(); },

  bindEvents() {
    document.querySelectorAll('.tab-item').forEach(t => t.addEventListener('click', () => this.switchTab(t.dataset.tab)));
    document.getElementById('order-form').addEventListener('submit', (e) => { e.preventDefault(); this.submitOrder(); });
    document.getElementById('order-list').addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (btn) this.setOrderFilter(btn.dataset.filter);
    });
    document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', (e) => {
      if (e.target === m) m.classList.remove('open');
    }));
    document.querySelectorAll('.service-card').forEach(c => c.addEventListener('click', () => {
      if (c.dataset.action === 'new-order') this.switchTab('order');
    }));
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
