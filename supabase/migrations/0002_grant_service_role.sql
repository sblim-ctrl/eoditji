-- 새 테이블 자동 노출을 꺼서 service_role(서버·스크립트용 secret 키)에도 권한이 없음.
-- service_role은 RLS를 무시하는 관리자 역할이라 브라우저에는 절대 나가지 않음 (rls-check, 평가·내보내기 스크립트용)
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
