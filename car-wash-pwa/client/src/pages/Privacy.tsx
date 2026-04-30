import MarketingLayout from '../components/marketing/MarketingLayout';

export default function Privacy() {
  return (
    <MarketingLayout>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2 text-center">سياسة الخصوصية</h1>
        <p className="text-sm text-gray-400 text-center mb-12">
          آخر تحديث: ١ يناير ٢٠٢٦
        </p>

        {/* 1 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">١. من نحن</h2>
          <p className="text-gray-300 leading-relaxed">
            منصة <span className="font-bold text-white">جداول (Jadawel)</span> هي
            منصة سعودية متخصصة في تمكين مقدّمي الخدمات من إدارة أعمالهم رقميًا،
            بما يشمل الحجوزات والمدفوعات وإدارة العملاء والتسويق. يشار إليها
            فيما يلي بـ «المنصة» أو «نحن». نلتزم بحماية خصوصيتك وفقًا لنظام
            حماية البيانات الشخصية في المملكة العربية السعودية (PDPL).
          </p>
        </section>

        {/* 2 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">٢. البيانات التي نجمعها</h2>
          <ul className="list-disc list-inside text-gray-300 space-y-2 leading-relaxed">
            <li>
              <span className="font-medium text-white">بيانات شخصية:</span> الاسم
              الكامل، رقم الجوال، البريد الإلكتروني، العنوان، ونوع المركبة (إن
              وُجد).
            </li>
            <li>
              <span className="font-medium text-white">بيانات الاستخدام:</span>{" "}
              سجلّات الحجوزات، الصفحات المُزارة، نوع الجهاز والمتصفح، وعنوان IP.
            </li>
            <li>
              <span className="font-medium text-white">بيانات الدفع:</span> معلومات
              البطاقة المصرفية أو المحفظة الرقمية المستخدمة لإتمام المعاملات (تتم
              معالجتها عبر بوابات دفع معتمدة ولا نخزّنها مباشرةً).
            </li>
          </ul>
        </section>

        {/* 3 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">٣. كيف نستخدم بياناتك</h2>
          <ul className="list-disc list-inside text-gray-300 space-y-2 leading-relaxed">
            <li>تقديم الخدمات وإتمام الحجوزات والمدفوعات.</li>
            <li>تحسين تجربة المستخدم وتطوير ميزات جديدة بالمنصة.</li>
            <li>
              التواصل معك بشأن حسابك أو حجوزاتك أو العروض الترويجية (بموافقتك).
            </li>
            <li>الامتثال للمتطلبات النظامية والقانونية المعمول بها.</li>
          </ul>
        </section>

        {/* 4 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">٤. مشاركة البيانات</h2>
          <p className="text-gray-300 leading-relaxed">
            لا نبيع بياناتك الشخصية لأي طرف ثالث مطلقًا. قد نشارك بياناتك فقط
            مع:
          </p>
          <ul className="list-disc list-inside text-gray-300 space-y-2 mt-3 leading-relaxed">
            <li>مقدّمي الخدمات المسجّلين على المنصة لإتمام الحجوزات.</li>
            <li>
              مزوّدي الخدمات التقنية (الاستضافة، بوابات الدفع، خدمات الرسائل)
              بموجب اتفاقيات سرية.
            </li>
            <li>الجهات الحكومية عند وجود التزام قانوني بذلك.</li>
          </ul>
        </section>

        {/* 5 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">٥. حماية البيانات</h2>
          <p className="text-gray-300 leading-relaxed">
            نطبّق إجراءات أمنية صارمة تشمل التشفير بمعيار AES-256 للبيانات
            الحساسة، وبروتوكول HTTPS لجميع الاتصالات، وضوابط صلاحيات الوصول
            المبنية على الأدوار، والنسخ الاحتياطي الدوري. كما نُجري مراجعات أمنية
            منتظمة لضمان سلامة بياناتك.
          </p>
        </section>

        {/* 6 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">٦. حقوقك</h2>
          <p className="text-gray-300 leading-relaxed mb-3">
            وفقًا لنظام حماية البيانات الشخصية (PDPL) في المملكة العربية
            السعودية، يحقّ لك:
          </p>
          <ul className="list-disc list-inside text-gray-300 space-y-2 leading-relaxed">
            <li>الوصول إلى بياناتك الشخصية المحفوظة لدينا.</li>
            <li>طلب تصحيح أي بيانات غير دقيقة أو غير مكتملة.</li>
            <li>طلب حذف بياناتك الشخصية (مع مراعاة الالتزامات القانونية).</li>
            <li>سحب موافقتك على معالجة البيانات في أي وقت.</li>
            <li>تقديم شكوى للجهة المختصة إذا رأيت أن حقوقك قد انتُهكت.</li>
          </ul>
        </section>

        {/* 7 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">
            ٧. ملفات تعريف الارتباط (Cookies)
          </h2>
          <p className="text-gray-300 leading-relaxed">
            نستخدم ملفات تعريف الارتباط لتحسين أداء المنصة وتخصيص تجربتك. تشمل
            ملفات ضرورية لتشغيل الموقع وأخرى تحليلية لفهم سلوك الاستخدام. يمكنك
            التحكّم في إعدادات ملفات تعريف الارتباط من خلال متصفحك، مع العلم أن
            تعطيلها قد يؤثر على بعض وظائف المنصة.
          </p>
        </section>

        {/* 8 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">
            ٨. التعديلات على السياسة
          </h2>
          <p className="text-gray-300 leading-relaxed">
            نحتفظ بالحق في تعديل هذه السياسة في أي وقت. سيتم إشعارك بأي تغييرات
            جوهرية عبر البريد الإلكتروني أو من خلال إشعار داخل المنصة. يُعدّ
            استمرارك في استخدام المنصة بعد نشر التعديلات قبولًا لها.
          </p>
        </section>

        {/* 9 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">٩. التواصل معنا</h2>
          <p className="text-gray-300 leading-relaxed">
            لأي استفسارات أو طلبات تتعلّق بخصوصيتك أو بياناتك الشخصية، يمكنك
            التواصل معنا عبر:
          </p>
          <ul className="list-none text-gray-300 space-y-2 mt-3 leading-relaxed">
            <li>
              البريد الإلكتروني:{" "}
              <span className="text-blue-400">privacy@jdawil.sa</span>
            </li>
            <li>
              الهاتف:{" "}
              <span className="text-blue-400" dir="ltr">
                +966 50 000 0000
              </span>
            </li>
            <li>المملكة العربية السعودية — الرياض</li>
          </ul>
        </section>

        <div className="border-t border-gray-800 pt-6 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} جداول. جميع الحقوق محفوظة.
        </div>
      </div>
    </MarketingLayout>
  );
}
