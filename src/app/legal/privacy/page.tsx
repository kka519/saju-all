import { businessInfo, siteConfig } from "@/config/site";

export const metadata = { title: "개인정보처리방침" };

export default function PrivacyPage() {
  return (
    <div className="container py-12 max-w-3xl prose-saju text-night-fg">
      <h1 className="text-2xl font-bold mb-6">개인정보처리방침</h1>
      <p>
        {businessInfo.companyName}(이하 &quot;회사&quot;라 함)은 {siteConfig.name}{" "}
        서비스(이하 &quot;서비스&quot;) 제공 과정에서 이용자로부터 개인정보를 제공받아 처리합니다. 회사는
        「개인정보 보호법」 등 관련 법령상의 개인정보 보호 규정을 준수하며, 이용자의 개인정보를 보호하고
        관련 고충을 신속히 처리하기 위해 다음과 같이 개인정보 처리방침을 수립·공개합니다.
      </p>

      <h2>1. 수집하는 개인정보 항목 및 수집방법</h2>
      <p>
        회사는 서비스의 안정적인 제공 및 운영을 위해 다음의 목적별로 필요한 시점에 개인정보를 수집합니다.
        필수 항목은 서비스 이용에 반드시 필요한 정보이며, 선택 항목은 동의하지 않아도 서비스 이용에
        제한이 없습니다.
      </p>
      <h3>1) 회원 가입 및 서비스 운영</h3>
      <ul>
        <li><strong>(필수)</strong> 이메일, 비밀번호(암호화 저장), 닉네임</li>
        <li><strong>(선택)</strong> 생년월일, 성별</li>
        <li>서비스 이용 기록(이용자 식별자, 방문 일시, IP 주소, 부정 이용 기록, 서비스 이용 내역), 디바이스 정보(OS, 기종, 사용 언어), 쿠키가 자동 수집될 수 있습니다.</li>
      </ul>
      <h3>2) AI 사주 분석 서비스 운영</h3>
      <ul>
        <li><strong>(필수)</strong> 닉네임, 생년월일, 성별, 출생 시각</li>
        <li><strong>(선택)</strong> 고민 키워드, 이름</li>
      </ul>
      <h3>3) 궁합 분석 서비스 이용 시 상대방 정보</h3>
      <p>
        커플 궁합 등 두 사람의 정보를 함께 분석하는 상품을 이용하는 경우, 이용자는 분석 대상인
        상대방의 개인정보를 대신 입력합니다. 이용자는 상대방으로부터 정보 제공에 대한 동의를
        받은 후 입력해야 하며, 무단으로 제3자의 정보를 입력하여 발생하는 책임은 입력한
        이용자에게 있습니다.
      </p>
      <ul>
        <li><strong>(필수)</strong> 상대방 생년월일, 성별, 출생 시각</li>
        <li><strong>(선택)</strong> 상대방 이름</li>
      </ul>
      <p>
        상대방 정보는 해당 궁합 분석 결과를 생성하는 목적으로만 이용되며, 이 목적 외에는
        이용·제공되지 않습니다. 보유·파기 기준은 본 방침 제4조·제5조를 따릅니다.
      </p>
      <h3>4) 결제 처리</h3>
      <ul>
        <li>결제 수단 정보, 결제 승인 정보는 결제대행사(토스페이먼츠)가 처리하며, 회사는 결제 키(paymentKey)와 주문번호만 저장합니다.</li>
      </ul>
      <h3>5) 고객 지원</h3>
      <ul>
        <li><strong>(필수)</strong> 이메일, 문의 내용</li>
      </ul>
      <p className="text-sm">※ 회사는 만 14세 미만 아동의 개인정보를 처리하지 않습니다.</p>

      <h2>2. 개인정보의 처리 목적</h2>
      <p>회사는 수집한 개인정보를 다음의 목적에만 이용합니다.</p>
      <ul>
        <li>이용자 식별 및 서비스 이용 의사 확인</li>
        <li>AI 사주 분석 결과 생성 및 제공</li>
        <li>결제 처리, 환불 및 분쟁 해결</li>
        <li>고객 문의 대응 및 서비스 개선</li>
        <li>부정 이용 방지, 계정 보호, 법령 및 이용약관 위반 행위 제한</li>
      </ul>

      <h2>3. 개인정보의 제3자 제공</h2>
      <p>회사는 이용자의 개인정보를 외부에 제공하지 않습니다. 다만 다음의 경우는 예외로 합니다.</p>
      <ul>
        <li>관련 법령에 따라 행정기관·수사기관이 적법한 절차로 제공을 요구한 경우</li>
        <li>이용자로부터 별도의 동의를 받은 경우</li>
      </ul>

      <h2>4. 개인정보의 보유 및 이용 기간</h2>
      <p>
        이용자의 개인정보는 수집 및 이용 목적이 달성되면 지체없이 파기합니다. 다만, 관계 법령에 따라
        다음과 같이 일정 기간 보관합니다.
      </p>
      <div className="my-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-hairline-strong">
              <th className="text-left py-2 px-3">항목</th>
              <th className="text-left py-2 px-3">근거 법령</th>
              <th className="text-left py-2 px-3">보존 기간</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-hairline">
              <td className="py-2 px-3">접속 일시, IP 주소</td>
              <td className="py-2 px-3">통신비밀보호법 제15조의2</td>
              <td className="py-2 px-3">3개월</td>
            </tr>
            <tr className="border-b border-hairline">
              <td className="py-2 px-3">소비자 불만 또는 분쟁처리 기록</td>
              <td className="py-2 px-3">전자상거래법 제6조</td>
              <td className="py-2 px-3">3년</td>
            </tr>
            <tr className="border-b border-hairline">
              <td className="py-2 px-3">계약 또는 청약철회 등에 관한 기록</td>
              <td className="py-2 px-3">전자상거래법 제6조</td>
              <td className="py-2 px-3">5년</td>
            </tr>
            <tr>
              <td className="py-2 px-3">대금결제 및 재화 공급에 관한 기록</td>
              <td className="py-2 px-3">전자상거래법 제6조</td>
              <td className="py-2 px-3">5년</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>5. 개인정보의 파기 절차 및 방법</h2>
      <p>전자적 파일은 기록을 재생할 수 없도록 파기하며, 종이 문서는 분쇄기로 분쇄하거나 소각하여 파기합니다.</p>

      <h2>6. 개인정보의 처리 위탁</h2>
      <p>회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리를 외부에 위탁합니다.</p>
      <h3>1) 국내 위탁</h3>
      <div className="my-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-hairline-strong">
              <th className="text-left py-2 px-3">수탁업체</th>
              <th className="text-left py-2 px-3">위탁 업무</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-2 px-3">토스페이먼츠</td>
              <td className="py-2 px-3">결제 처리 및 결제 정보 관리</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h3>2) 국외 위탁 (국외이전)</h3>
      <div className="my-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-hairline-strong">
              <th className="text-left py-2 px-3">수탁업체</th>
              <th className="text-left py-2 px-3">위탁 업무</th>
              <th className="text-left py-2 px-3">이전 국가</th>
              <th className="text-left py-2 px-3">이용 기간</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-hairline">
              <td className="py-2 px-3">Supabase Inc.</td>
              <td className="py-2 px-3">데이터베이스 운영 및 인증 관리</td>
              <td className="py-2 px-3">미국</td>
              <td className="py-2 px-3">회원 탈퇴 시 또는 위탁 계약 종료 시까지</td>
            </tr>
            <tr className="border-b border-hairline">
              <td className="py-2 px-3">OpenAI / Anthropic / Google</td>
              <td className="py-2 px-3">AI 사주 분석 서비스 제공</td>
              <td className="py-2 px-3">미국</td>
              <td className="py-2 px-3">서비스 이용 시점에 한하여 처리(별도 저장하지 않음)</td>
            </tr>
            <tr>
              <td className="py-2 px-3">{businessInfo.hostingProvider}</td>
              <td className="py-2 px-3">웹 호스팅 서비스 제공</td>
              <td className="py-2 px-3">미국</td>
              <td className="py-2 px-3">회원 탈퇴 시 또는 위탁 계약 종료 시까지</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>7. 이용자 및 법정대리인의 권리와 행사 방법</h2>
      <p>
        이용자는 개인정보 처리를 거부·제한하거나, 개인정보를 열람·수정·삭제·이전할 권리를 보유합니다.
        관련 문의는 아래 개인정보 보호책임자에게 이메일로 연락주시기 바랍니다.
      </p>
      <ul>
        <li>웹사이트의 &quot;마이페이지&quot; 메뉴에서 본인의 개인정보를 직접 조회·수정할 수 있습니다.</li>
        <li>삭제를 원하는 경우 &quot;설정&quot; 메뉴 또는 이메일({businessInfo.email})로 요청할 수 있습니다.</li>
        <li>회사는 열람 요구에 대하여 10일 이내에 응합니다.</li>
      </ul>

      <h2>8. 개인정보의 안전성 확보 조치</h2>
      <ul>
        <li><strong>관리적 보호대책:</strong> 내부 관리계획의 수립·시행, 정기적 직원 교육, 수탁업체 감독</li>
        <li><strong>기술적 보호대책:</strong> 개인정보처리시스템 접근권한 관리, 암호화, 보안 프로그램 운영</li>
        <li><strong>물리적 보호대책:</strong> 전산실·자료보관실 접근통제</li>
      </ul>

      <h2>9. 쿠키(Cookie)의 운영 및 거부</h2>
      <p>
        회사는 이용자 맞춤형 서비스 제공 및 서비스 이용 형태 분석을 위해 쿠키를 사용합니다. 이용자는 웹
        브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 일부 서비스 이용에 어려움이 있을 수
        있습니다.
      </p>

      <h2>10. 개인정보 보호책임자</h2>
      <ul>
        <li>책임자: {businessInfo.privacyOfficer}</li>
        <li>이메일: {businessInfo.email}</li>
      </ul>
      <p>회사와 별개의 기관으로 개인정보 침해에 관한 신고나 상담이 필요하신 경우 아래로 문의하실 수 있습니다.</p>
      <ul>
        <li>개인정보침해신고센터 (privacy.kisa.or.kr / 국번없이 118)</li>
        <li>개인정보 분쟁조정위원회 (www.kopico.go.kr / 국번없이 1833-6972)</li>
        <li>대검찰청 사이버수사과 (www.spo.go.kr / 국번없이 1301)</li>
        <li>경찰청 사이버안전국 (ecrm.cyber.go.kr / 국번없이 182)</li>
      </ul>

      <h2>11. 개인정보처리방침의 공개와 개정</h2>
      <p>
        회사가 본 개인정보처리방침을 변경할 경우, 시행일자 및 개정내용을 명시하여 시행일 7일 이전에
        웹사이트에 공지합니다. 다만, 이용자의 권리에 중대한 변경이 있을 경우 30일 이전에 공지합니다.
      </p>

      <h2>[부칙]</h2>
      <p>본 개인정보 처리방침은 {businessInfo.effectiveDate}부터 시행합니다.</p>
    </div>
  );
}
