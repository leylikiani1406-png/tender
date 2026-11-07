// گردش‌کار مناقصه (نسخه ۴)
// ثبت (کارشناس مناقصات) ← همزمان: بررسی مدیر دفتر فنی + تصمیم مدیرعامل
//   مدیرعامل «خیر» ← بسته شد (به کارتابل کارشناس)
//   مدیرعامل «بله» ← در حال انجام (به کارتابل کارشناس)؛ اگر ضمانت‌نامه لازم باشد همزمان به مالی ← دریافت ← خبر به کارشناس
//   مدیر فنی کار را به همکاران ارجاع می‌دهد (همکار فقط همان کار را می‌بیند و فایل بارگذاری می‌کند)
//   کارشناس «اتمام مناقصه» یا «لغو» ← اتمام‌یافته / لغو شده
const ADMIN = ['super_admin'];
const has = list => r => [...list, ...ADMIN].includes(r);

module.exports = {
  KINDS: ['exploration', 'supervision'],
  PACKAGES: ['quality', 'technical', 'price', 'full'],
  SUBMIT: ['sending', 'sent', 'awaiting_winner'],
  PARTS: ['schedule', 'technical_proposal', 'quality_docs', 'price', 'other'],
  RUNNING: ['review', 'active'],
  DONE: ['closed', 'cancelled', 'finished'],
  canCreate: has(['procurement', 'ceo']),
  canEditBasic: has(['procurement', 'ceo', 'technical_manager']),
  canEditOffer: has(['financial', 'ceo', 'technical_manager']),
  canTech: has(['technical_manager']),
  canAssign: has(['technical_manager', 'ceo']),
  canCeo: has(['ceo']),
  canFinance: has(['financial']),
  canProc: has(['procurement']),
  canStatus: has(['procurement', 'ceo']),
  canForm: has(['procurement', 'technical_manager', 'technical_expert', 'ceo']),
  canResult: has(['procurement', 'ceo']),
  fileRoles: {
    tender: has(['procurement', 'ceo', 'technical_manager']),
    change: has(['procurement', 'ceo', 'technical_manager', 'financial']),
    archive: has(['procurement', 'ceo']),
    feasibility: has(['procurement', 'technical_manager', 'technical_expert']),
    guarantee: has(['financial']),
    work: has(['technical_manager', 'technical_expert', 'procurement', 'ceo', 'staff'])
  },
  permsFor(role, status) {
    const open = status === 'review' || status === 'active';
    return {
      tech: this.canTech(role) && status === 'review',
      assign: this.canAssign(role) && open,
      ceo: this.canCeo(role) && status !== 'finished' && status !== 'cancelled',
      finance: this.canFinance(role),
      proc: this.canProc(role),
      status: this.canStatus(role) && status === 'active',
      form: this.canForm(role),
      result: this.canResult(role),
      edit: open && (this.canEditBasic(role) || this.canEditOffer(role)),
      edit_basic: this.canEditBasic(role), edit_offer: this.canEditOffer(role),
      staff: role === 'staff',
      files: { tender: this.fileRoles.tender(role), feasibility: this.fileRoles.feasibility(role), guarantee: this.fileRoles.guarantee(role), work: this.fileRoles.work(role), change: this.fileRoles.change(role), archive: this.fileRoles.archive(role) },
      change: this.fileRoles.change(role) && (status === 'review' || status === 'active')
    };
  }
};
