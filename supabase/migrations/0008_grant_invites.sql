-- 0002처럼 새 테이블에도 service_role(서버·스크립트용) 권한을 준다. 브라우저 키(authenticated)에는 여전히 없음
grant all on public.group_invites to service_role;
