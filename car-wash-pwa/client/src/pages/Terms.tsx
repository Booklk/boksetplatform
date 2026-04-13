export default function Terms() {
  return (
    <div className="min-h-screen bg-[#040812] text-white" dir="rtl">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2 text-center">
          الشروط والأحكام
        </h1>
        <p className="text-sm text-gray-400 text-center mb-12">
          آخر تحديث: ١ يناير ٢٠٢٦
        </p>

        {/* 1 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">١. تعريفات</h2>
          <ul className="list-disc list-inside text-gray-300 space-y-2 leading-relaxed">
            <li>
              <span className="font-medium text-white">المنصة:</span> منصة بوكست
              (Bokset) الإلكترونية وتطبيقاتها.
            </li>
            <li>
              <span className="font-medium text-white">المستخدم:</span> أي شخص
              يصل إلى المنصة أو يستخدمها بأي صفة.
            </li>
            <li>
              <span className="font-medium text-white">التاجر:</span> مقدّم
              الخدمات المسجّل على المنصة لإدارة أعماله واستقبال الحجوزات.
            </li>
            <li>
              <span className="font-medium text-white">العميل:</span> الشخص الذي
              يحجز أو يشتري خدمة من خلال المنصة.
            </li>
          </ul>
        </section>

        {/* 2 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">٢. شروط الاستخدام</h2>
          <p className="text-gray-300 leading-relaxed">
            باستخدامك المنصة فإنك توافق على هذه الشروط والأحكام. يجب ألّا يقلّ
            عمرك عن 18 عامًا لاستخدام المنصة. تلتزم بتقديم معلومات صحيحة ودقيقة
            عند التسجيل، وعدم استخدام المنصة لأي غرض غير مشروع أو يخالف الأنظمة
            المعمول بها في المملكة العربية السعودية. يحقّ للمنصة تعليق أو إنهاء
            حسابك في حال مخالفة هذه الشروط.
          </p>
        </section>

        {/* 3 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">
            ٣. الاشتراكات والمدفوعات
          </h2>
          <ul className="list-disc list-inside text-gray-300 space-y-2 leading-relaxed">
            <li>
              توفّر المنصة فترة تجريبية مجانية مدتها 14 يومًا للتجّار الجدد.
            </li>
            <li>
              بعد انتهاء الفترة التجريبية يتوجّب على التاجر اختيار خطة اشتراك
              (أساسية، احترافية، أو مؤسسية) لمواصلة استخدام المنصة.
            </li>
            <li>
              تُحصّل رسوم الاشتراك دوريًا (شهريًا أو سنويًا) حسب الخطة المختارة
              عبر بوابات الدفع المعتمدة.
            </li>
            <li>
              جميع الأسعار المعروضة شاملة لضريبة القيمة المضافة ما لم يُذكر خلاف
              ذلك.
            </li>
            <li>
              يتحمّل التاجر مسؤولية تحديث بيانات الدفع لضمان استمرارية الاشتراك.
            </li>
          </ul>
        </section>

        {/* 4 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">
            ٤. حقوق والتزامات التاجر
          </h2>
          <ul className="list-disc list-inside text-gray-300 space-y-2 leading-relaxed">
            <li>الحصول على لوحة تحكّم كاملة لإدارة الحجوزات والخدمات والموظفين.</li>
            <li>تقديم خدمات ذات جودة عالية والالتزام بالمواعيد المحددة.</li>
            <li>
              عدم استخدام المنصة للترويج لمحتوى مخالف أو خدمات غير مرخّصة.
            </li>
            <li>الحفاظ على سرية بيانات العملاء وعدم استخدامها خارج المنصة.</li>
            <li>الامتثال لجميع الأنظمة والتشريعات المعمول بها في المملكة.</li>
          </ul>
        </section>

        {/* 5 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">
            ٥. حقوق والتزامات المنصة
          </h2>
          <ul className="list-disc list-inside text-gray-300 space-y-2 leading-relaxed">
            <li>توفير بيئة تقنية مستقرة وآمنة لجميع المستخدمين.</li>
            <li>تطوير المنصة وإضافة ميزات جديدة بشكل مستمر.</li>
            <li>
              الحق في تعديل الأسعار والخطط مع إشعار مسبق لا يقلّ عن 30 يومًا.
            </li>
            <li>
              الحق في إزالة أي محتوى أو تعليق أي حساب يخالف الشروط والأحكام.
            </li>
          </ul>
        </section>

        {/* 6 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">
            ٦. سياسة الإلغاء والاسترجاع
          </h2>
          <p className="text-gray-300 leading-relaxed">
            يحقّ للتاجر إلغاء اشتراكه في أي وقت من خلال لوحة التحكّم. يسري
            الإلغاء في نهاية دورة الفوترة الحالية. لا تُسترجع رسوم الفترة
            المتبقية من الاشتراك إلا في حالات استثنائية تقدّرها المنصة. بالنسبة
            لحجوزات العملاء، تخضع سياسة الإلغاء والاسترجاع للشروط التي يحدّدها
            كل تاجر على حدة.
          </p>
        </section>

        {/* 7 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">٧. حدود المسؤولية</h2>
          <p className="text-gray-300 leading-relaxed">
            المنصة وسيط تقني يربط بين التجّار والعملاء ولا تُعدّ طرفًا في
            العلاقة التعاقدية بينهما. لا تتحمّل المنصة المسؤولية عن جودة
            الخدمات المقدّمة من التجّار، أو أي أضرار ناتجة عن انقطاع الخدمة
            لأسباب خارجة عن إرادتها، أو أي خسائر غير مباشرة أو تبعية.
          </p>
        </section>

        {/* 8 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">٨. الملكية الفكرية</h2>
          <p className="text-gray-300 leading-relaxed">
            جميع حقوق الملكية الفكرية للمنصة — بما في ذلك التصميم والشعارات
            والكود البرمجي والمحتوى — مملوكة لشركة بوكست. لا يجوز نسخ أو
            استنساخ أو توزيع أي جزء من المنصة دون إذن كتابي مسبق. يحتفظ التاجر
            بملكية محتواه وبياناته المرفوعة على المنصة.
          </p>
        </section>

        {/* 9 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">٩. القانون المعمول به</h2>
          <p className="text-gray-300 leading-relaxed">
            تخضع هذه الشروط والأحكام لأنظمة وقوانين المملكة العربية السعودية
            وتُفسّر وفقًا لها. في حال نشوء أي نزاع، تختصّ المحاكم المختصة في
            مدينة الرياض بالنظر فيه والفصل به.
          </p>
        </section>

        {/* 10 */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">١٠. التواصل</h2>
          <p className="text-gray-300 leading-relaxed">
            لأي استفسارات أو ملاحظات حول هذه الشروط والأحكام، يُرجى التواصل
            معنا عبر:
          </p>
          <ul className="list-none text-gray-300 space-y-2 mt-3 leading-relaxed">
            <li>
              البريد الإلكتروني:{" "}
              <span className="text-blue-400">support@bokset.com</span>
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
          &copy; {new Date().getFullYear()} Bokset. جميع الحقوق محفوظة.
        </div>
      </div>
    </div>
  );
}
