
import * as antlr from "antlr4ng";
import { Token } from "antlr4ng";

// for running tests with parameters, TODO: discuss strategy for typed parameters in CI
// eslint-disable-next-line no-unused-vars
type int = number;


export class SqliteParser extends antlr.Parser {
    public static readonly SCOL = 1;
    public static readonly DOT = 2;
    public static readonly OPEN_PAR = 3;
    public static readonly CLOSE_PAR = 4;
    public static readonly COMMA = 5;
    public static readonly ASSIGN = 6;
    public static readonly STAR = 7;
    public static readonly PLUS = 8;
    public static readonly MINUS = 9;
    public static readonly TILDE = 10;
    public static readonly PIPE2 = 11;
    public static readonly DIV = 12;
    public static readonly MOD = 13;
    public static readonly LT2 = 14;
    public static readonly GT2 = 15;
    public static readonly AMP = 16;
    public static readonly PIPE = 17;
    public static readonly LT = 18;
    public static readonly LT_EQ = 19;
    public static readonly GT = 20;
    public static readonly GT_EQ = 21;
    public static readonly EQ = 22;
    public static readonly NOT_EQ1 = 23;
    public static readonly NOT_EQ2 = 24;
    public static readonly JPTR = 25;
    public static readonly JPTR2 = 26;
    public static readonly ABORT_ = 27;
    public static readonly ACTION_ = 28;
    public static readonly ADD_ = 29;
    public static readonly AFTER_ = 30;
    public static readonly ALL_ = 31;
    public static readonly ALTER_ = 32;
    public static readonly ALWAYS_ = 33;
    public static readonly ANALYZE_ = 34;
    public static readonly AND_ = 35;
    public static readonly AS_ = 36;
    public static readonly ASC_ = 37;
    public static readonly ATTACH_ = 38;
    public static readonly AUTOINCREMENT_ = 39;
    public static readonly BEFORE_ = 40;
    public static readonly BEGIN_ = 41;
    public static readonly BETWEEN_ = 42;
    public static readonly BY_ = 43;
    public static readonly CASCADE_ = 44;
    public static readonly CASE_ = 45;
    public static readonly CAST_ = 46;
    public static readonly CHECK_ = 47;
    public static readonly COLLATE_ = 48;
    public static readonly COLUMN_ = 49;
    public static readonly COMMIT_ = 50;
    public static readonly CONFLICT_ = 51;
    public static readonly CONSTRAINT_ = 52;
    public static readonly CREATE_ = 53;
    public static readonly CROSS_ = 54;
    public static readonly CURRENT_ = 55;
    public static readonly CURRENT_DATE_ = 56;
    public static readonly CURRENT_TIME_ = 57;
    public static readonly CURRENT_TIMESTAMP_ = 58;
    public static readonly DATABASE_ = 59;
    public static readonly DEFAULT_ = 60;
    public static readonly DEFERRABLE_ = 61;
    public static readonly DEFERRED_ = 62;
    public static readonly DELETE_ = 63;
    public static readonly DESC_ = 64;
    public static readonly DETACH_ = 65;
    public static readonly DISTINCT_ = 66;
    public static readonly DO_ = 67;
    public static readonly DROP_ = 68;
    public static readonly EACH_ = 69;
    public static readonly ELSE_ = 70;
    public static readonly END_ = 71;
    public static readonly ESCAPE_ = 72;
    public static readonly EXCEPT_ = 73;
    public static readonly EXCLUDE_ = 74;
    public static readonly EXCLUSIVE_ = 75;
    public static readonly EXISTS_ = 76;
    public static readonly EXPLAIN_ = 77;
    public static readonly FAIL_ = 78;
    public static readonly FALSE_ = 79;
    public static readonly FILTER_ = 80;
    public static readonly FIRST_ = 81;
    public static readonly FOLLOWING_ = 82;
    public static readonly FOR_ = 83;
    public static readonly FOREIGN_ = 84;
    public static readonly FROM_ = 85;
    public static readonly FULL_ = 86;
    public static readonly GENERATED_ = 87;
    public static readonly GLOB_ = 88;
    public static readonly GROUP_ = 89;
    public static readonly GROUPS_ = 90;
    public static readonly HAVING_ = 91;
    public static readonly IF_ = 92;
    public static readonly IGNORE_ = 93;
    public static readonly IMMEDIATE_ = 94;
    public static readonly IN_ = 95;
    public static readonly INDEX_ = 96;
    public static readonly INDEXED_ = 97;
    public static readonly INITIALLY_ = 98;
    public static readonly INNER_ = 99;
    public static readonly INSERT_ = 100;
    public static readonly INSTEAD_ = 101;
    public static readonly INTERSECT_ = 102;
    public static readonly INTO_ = 103;
    public static readonly IS_ = 104;
    public static readonly ISNULL_ = 105;
    public static readonly JOIN_ = 106;
    public static readonly KEY_ = 107;
    public static readonly LAST_ = 108;
    public static readonly LEFT_ = 109;
    public static readonly LIKE_ = 110;
    public static readonly LIMIT_ = 111;
    public static readonly MATCH_ = 112;
    public static readonly MATERIALIZED_ = 113;
    public static readonly NATURAL_ = 114;
    public static readonly NO_ = 115;
    public static readonly NOT_ = 116;
    public static readonly NOTHING_ = 117;
    public static readonly NOTNULL_ = 118;
    public static readonly NULL_ = 119;
    public static readonly NULLS_ = 120;
    public static readonly OF_ = 121;
    public static readonly OFFSET_ = 122;
    public static readonly ON_ = 123;
    public static readonly OR_ = 124;
    public static readonly ORDER_ = 125;
    public static readonly OTHERS_ = 126;
    public static readonly OUTER_ = 127;
    public static readonly OVER_ = 128;
    public static readonly PARTITION_ = 129;
    public static readonly PLAN_ = 130;
    public static readonly PRAGMA_ = 131;
    public static readonly PRECEDING_ = 132;
    public static readonly PRIMARY_ = 133;
    public static readonly QUERY_ = 134;
    public static readonly RAISE_ = 135;
    public static readonly RANGE_ = 136;
    public static readonly RECURSIVE_ = 137;
    public static readonly REFERENCES_ = 138;
    public static readonly REGEXP_ = 139;
    public static readonly REINDEX_ = 140;
    public static readonly RELEASE_ = 141;
    public static readonly RENAME_ = 142;
    public static readonly REPLACE_ = 143;
    public static readonly RESTRICT_ = 144;
    public static readonly RETURNING_ = 145;
    public static readonly RIGHT_ = 146;
    public static readonly ROLLBACK_ = 147;
    public static readonly ROW_ = 148;
    public static readonly ROWID_ = 149;
    public static readonly ROWS_ = 150;
    public static readonly SAVEPOINT_ = 151;
    public static readonly SELECT_ = 152;
    public static readonly SET_ = 153;
    public static readonly STORED_ = 154;
    public static readonly STRICT_ = 155;
    public static readonly TABLE_ = 156;
    public static readonly TEMP_ = 157;
    public static readonly TEMPORARY_ = 158;
    public static readonly THEN_ = 159;
    public static readonly TIES_ = 160;
    public static readonly TO_ = 161;
    public static readonly TRANSACTION_ = 162;
    public static readonly TRIGGER_ = 163;
    public static readonly TRUE_ = 164;
    public static readonly UNBOUNDED_ = 165;
    public static readonly UNION_ = 166;
    public static readonly UNIQUE_ = 167;
    public static readonly UPDATE_ = 168;
    public static readonly USING_ = 169;
    public static readonly VACUUM_ = 170;
    public static readonly VALUES_ = 171;
    public static readonly VIEW_ = 172;
    public static readonly VIRTUAL_ = 173;
    public static readonly WHEN_ = 174;
    public static readonly WHERE_ = 175;
    public static readonly WINDOW_ = 176;
    public static readonly WITH_ = 177;
    public static readonly WITHIN_ = 178;
    public static readonly WITHOUT_ = 179;
    public static readonly IDENTIFIER = 180;
    public static readonly NUMERIC_LITERAL = 181;
    public static readonly BIND_PARAMETER = 182;
    public static readonly STRING_LITERAL = 183;
    public static readonly BLOB_LITERAL = 184;
    public static readonly SINGLE_LINE_COMMENT = 185;
    public static readonly MULTILINE_COMMENT = 186;
    public static readonly SPACES = 187;
    public static readonly UNEXPECTED_CHAR = 188;
    public static readonly RULE_parse = 0;
    public static readonly RULE_sql_stmt_list = 1;
    public static readonly RULE_sql_stmt = 2;
    public static readonly RULE_alter_table_stmt = 3;
    public static readonly RULE_analyze_stmt = 4;
    public static readonly RULE_attach_stmt = 5;
    public static readonly RULE_begin_stmt = 6;
    public static readonly RULE_commit_stmt = 7;
    public static readonly RULE_rollback_stmt = 8;
    public static readonly RULE_savepoint_stmt = 9;
    public static readonly RULE_release_stmt = 10;
    public static readonly RULE_create_index_stmt = 11;
    public static readonly RULE_indexed_column = 12;
    public static readonly RULE_create_table_stmt = 13;
    public static readonly RULE_table_options = 14;
    public static readonly RULE_column_def = 15;
    public static readonly RULE_type_name = 16;
    public static readonly RULE_column_constraint = 17;
    public static readonly RULE_signed_number = 18;
    public static readonly RULE_table_constraint = 19;
    public static readonly RULE_foreign_key_clause = 20;
    public static readonly RULE_conflict_clause = 21;
    public static readonly RULE_create_trigger_stmt = 22;
    public static readonly RULE_create_view_stmt = 23;
    public static readonly RULE_create_virtual_table_stmt = 24;
    public static readonly RULE_with_clause = 25;
    public static readonly RULE_common_table_expression = 26;
    public static readonly RULE_cte_table_name = 27;
    public static readonly RULE_delete_stmt = 28;
    public static readonly RULE_detach_stmt = 29;
    public static readonly RULE_drop_stmt = 30;
    public static readonly RULE_expr = 31;
    public static readonly RULE_expr_or = 32;
    public static readonly RULE_expr_and = 33;
    public static readonly RULE_expr_not = 34;
    public static readonly RULE_expr_binary = 35;
    public static readonly RULE_expr_comparison = 36;
    public static readonly RULE_expr_bitwise = 37;
    public static readonly RULE_expr_addition = 38;
    public static readonly RULE_expr_multiplication = 39;
    public static readonly RULE_expr_string = 40;
    public static readonly RULE_expr_collate = 41;
    public static readonly RULE_expr_unary = 42;
    public static readonly RULE_expr_base = 43;
    public static readonly RULE_expr_recursive = 44;
    public static readonly RULE_raise_function = 45;
    public static readonly RULE_literal_value = 46;
    public static readonly RULE_percentile_clause = 47;
    public static readonly RULE_value_row = 48;
    public static readonly RULE_values_clause = 49;
    public static readonly RULE_insert_stmt = 50;
    public static readonly RULE_returning_clause = 51;
    public static readonly RULE_upsert_clause = 52;
    public static readonly RULE_pragma_stmt = 53;
    public static readonly RULE_pragma_value = 54;
    public static readonly RULE_reindex_stmt = 55;
    public static readonly RULE_select_stmt = 56;
    public static readonly RULE_join_clause = 57;
    public static readonly RULE_join_step = 58;
    public static readonly RULE_select_core = 59;
    public static readonly RULE_table_or_subquery = 60;
    public static readonly RULE_result_column = 61;
    public static readonly RULE_join_operator = 62;
    public static readonly RULE_join_constraint = 63;
    public static readonly RULE_compound_operator = 64;
    public static readonly RULE_update_stmt = 65;
    public static readonly RULE_column_name_list = 66;
    public static readonly RULE_qualified_table_name = 67;
    public static readonly RULE_vacuum_stmt = 68;
    public static readonly RULE_filter_clause = 69;
    public static readonly RULE_window_defn = 70;
    public static readonly RULE_over_clause = 71;
    public static readonly RULE_frame_spec = 72;
    public static readonly RULE_frame_clause = 73;
    public static readonly RULE_order_clause = 74;
    public static readonly RULE_limit_clause = 75;
    public static readonly RULE_ordering_term = 76;
    public static readonly RULE_asc_desc = 77;
    public static readonly RULE_frame_left = 78;
    public static readonly RULE_frame_right = 79;
    public static readonly RULE_frame_single = 80;
    public static readonly RULE_error_message = 81;
    public static readonly RULE_filename = 82;
    public static readonly RULE_module_argument = 83;
    public static readonly RULE_module_argument_outer = 84;
    public static readonly RULE_module_argument_inner = 85;
    public static readonly RULE_fallback_excluding_conflicts = 86;
    public static readonly RULE_join_keyword = 87;
    public static readonly RULE_fallback = 88;
    public static readonly RULE_name = 89;
    public static readonly RULE_function_name = 90;
    public static readonly RULE_schema_name = 91;
    public static readonly RULE_table_name = 92;
    public static readonly RULE_table_or_index_name = 93;
    public static readonly RULE_column_name = 94;
    public static readonly RULE_column_name_excluding_string = 95;
    public static readonly RULE_column_alias = 96;
    public static readonly RULE_collation_name = 97;
    public static readonly RULE_foreign_table = 98;
    public static readonly RULE_index_name = 99;
    public static readonly RULE_trigger_name = 100;
    public static readonly RULE_view_name = 101;
    public static readonly RULE_module_name = 102;
    public static readonly RULE_pragma_name = 103;
    public static readonly RULE_savepoint_name = 104;
    public static readonly RULE_table_alias = 105;
    public static readonly RULE_table_alias_excluding_joins = 106;
    public static readonly RULE_window_name = 107;
    public static readonly RULE_alias = 108;
    public static readonly RULE_base_window_name = 109;
    public static readonly RULE_table_function_name = 110;
    public static readonly RULE_any_name_excluding_raise = 111;
    public static readonly RULE_any_name_excluding_joins = 112;
    public static readonly RULE_any_name_excluding_string = 113;
    public static readonly RULE_any_name = 114;

    public static readonly literalNames = [
        null, "';'", "'.'", "'('", "')'", "','", "'='", "'*'", "'+'", "'-'", 
        "'~'", "'||'", "'/'", "'%'", "'<<'", "'>>'", "'&'", "'|'", "'<'", 
        "'<='", "'>'", "'>='", "'=='", "'!='", "'<>'", "'->'", "'->>'", 
        "'ABORT'", "'ACTION'", "'ADD'", "'AFTER'", "'ALL'", "'ALTER'", "'ALWAYS'", 
        "'ANALYZE'", "'AND'", "'AS'", "'ASC'", "'ATTACH'", "'AUTOINCREMENT'", 
        "'BEFORE'", "'BEGIN'", "'BETWEEN'", "'BY'", "'CASCADE'", "'CASE'", 
        "'CAST'", "'CHECK'", "'COLLATE'", "'COLUMN'", "'COMMIT'", "'CONFLICT'", 
        "'CONSTRAINT'", "'CREATE'", "'CROSS'", "'CURRENT'", "'CURRENT_DATE'", 
        "'CURRENT_TIME'", "'CURRENT_TIMESTAMP'", "'DATABASE'", "'DEFAULT'", 
        "'DEFERRABLE'", "'DEFERRED'", "'DELETE'", "'DESC'", "'DETACH'", 
        "'DISTINCT'", "'DO'", "'DROP'", "'EACH'", "'ELSE'", "'END'", "'ESCAPE'", 
        "'EXCEPT'", "'EXCLUDE'", "'EXCLUSIVE'", "'EXISTS'", "'EXPLAIN'", 
        "'FAIL'", "'FALSE'", "'FILTER'", "'FIRST'", "'FOLLOWING'", "'FOR'", 
        "'FOREIGN'", "'FROM'", "'FULL'", "'GENERATED'", "'GLOB'", "'GROUP'", 
        "'GROUPS'", "'HAVING'", "'IF'", "'IGNORE'", "'IMMEDIATE'", "'IN'", 
        "'INDEX'", "'INDEXED'", "'INITIALLY'", "'INNER'", "'INSERT'", "'INSTEAD'", 
        "'INTERSECT'", "'INTO'", "'IS'", "'ISNULL'", "'JOIN'", "'KEY'", 
        "'LAST'", "'LEFT'", "'LIKE'", "'LIMIT'", "'MATCH'", "'MATERIALIZED'", 
        "'NATURAL'", "'NO'", "'NOT'", "'NOTHING'", "'NOTNULL'", "'NULL'", 
        "'NULLS'", "'OF'", "'OFFSET'", "'ON'", "'OR'", "'ORDER'", "'OTHERS'", 
        "'OUTER'", "'OVER'", "'PARTITION'", "'PLAN'", "'PRAGMA'", "'PRECEDING'", 
        "'PRIMARY'", "'QUERY'", "'RAISE'", "'RANGE'", "'RECURSIVE'", "'REFERENCES'", 
        "'REGEXP'", "'REINDEX'", "'RELEASE'", "'RENAME'", "'REPLACE'", "'RESTRICT'", 
        "'RETURNING'", "'RIGHT'", "'ROLLBACK'", "'ROW'", "'ROWID'", "'ROWS'", 
        "'SAVEPOINT'", "'SELECT'", "'SET'", "'STORED'", "'STRICT'", "'TABLE'", 
        "'TEMP'", "'TEMPORARY'", "'THEN'", "'TIES'", "'TO'", "'TRANSACTION'", 
        "'TRIGGER'", "'TRUE'", "'UNBOUNDED'", "'UNION'", "'UNIQUE'", "'UPDATE'", 
        "'USING'", "'VACUUM'", "'VALUES'", "'VIEW'", "'VIRTUAL'", "'WHEN'", 
        "'WHERE'", "'WINDOW'", "'WITH'", "'WITHIN'", "'WITHOUT'"
    ];

    public static readonly symbolicNames = [
        null, "SCOL", "DOT", "OPEN_PAR", "CLOSE_PAR", "COMMA", "ASSIGN", 
        "STAR", "PLUS", "MINUS", "TILDE", "PIPE2", "DIV", "MOD", "LT2", 
        "GT2", "AMP", "PIPE", "LT", "LT_EQ", "GT", "GT_EQ", "EQ", "NOT_EQ1", 
        "NOT_EQ2", "JPTR", "JPTR2", "ABORT_", "ACTION_", "ADD_", "AFTER_", 
        "ALL_", "ALTER_", "ALWAYS_", "ANALYZE_", "AND_", "AS_", "ASC_", 
        "ATTACH_", "AUTOINCREMENT_", "BEFORE_", "BEGIN_", "BETWEEN_", "BY_", 
        "CASCADE_", "CASE_", "CAST_", "CHECK_", "COLLATE_", "COLUMN_", "COMMIT_", 
        "CONFLICT_", "CONSTRAINT_", "CREATE_", "CROSS_", "CURRENT_", "CURRENT_DATE_", 
        "CURRENT_TIME_", "CURRENT_TIMESTAMP_", "DATABASE_", "DEFAULT_", 
        "DEFERRABLE_", "DEFERRED_", "DELETE_", "DESC_", "DETACH_", "DISTINCT_", 
        "DO_", "DROP_", "EACH_", "ELSE_", "END_", "ESCAPE_", "EXCEPT_", 
        "EXCLUDE_", "EXCLUSIVE_", "EXISTS_", "EXPLAIN_", "FAIL_", "FALSE_", 
        "FILTER_", "FIRST_", "FOLLOWING_", "FOR_", "FOREIGN_", "FROM_", 
        "FULL_", "GENERATED_", "GLOB_", "GROUP_", "GROUPS_", "HAVING_", 
        "IF_", "IGNORE_", "IMMEDIATE_", "IN_", "INDEX_", "INDEXED_", "INITIALLY_", 
        "INNER_", "INSERT_", "INSTEAD_", "INTERSECT_", "INTO_", "IS_", "ISNULL_", 
        "JOIN_", "KEY_", "LAST_", "LEFT_", "LIKE_", "LIMIT_", "MATCH_", 
        "MATERIALIZED_", "NATURAL_", "NO_", "NOT_", "NOTHING_", "NOTNULL_", 
        "NULL_", "NULLS_", "OF_", "OFFSET_", "ON_", "OR_", "ORDER_", "OTHERS_", 
        "OUTER_", "OVER_", "PARTITION_", "PLAN_", "PRAGMA_", "PRECEDING_", 
        "PRIMARY_", "QUERY_", "RAISE_", "RANGE_", "RECURSIVE_", "REFERENCES_", 
        "REGEXP_", "REINDEX_", "RELEASE_", "RENAME_", "REPLACE_", "RESTRICT_", 
        "RETURNING_", "RIGHT_", "ROLLBACK_", "ROW_", "ROWID_", "ROWS_", 
        "SAVEPOINT_", "SELECT_", "SET_", "STORED_", "STRICT_", "TABLE_", 
        "TEMP_", "TEMPORARY_", "THEN_", "TIES_", "TO_", "TRANSACTION_", 
        "TRIGGER_", "TRUE_", "UNBOUNDED_", "UNION_", "UNIQUE_", "UPDATE_", 
        "USING_", "VACUUM_", "VALUES_", "VIEW_", "VIRTUAL_", "WHEN_", "WHERE_", 
        "WINDOW_", "WITH_", "WITHIN_", "WITHOUT_", "IDENTIFIER", "NUMERIC_LITERAL", 
        "BIND_PARAMETER", "STRING_LITERAL", "BLOB_LITERAL", "SINGLE_LINE_COMMENT", 
        "MULTILINE_COMMENT", "SPACES", "UNEXPECTED_CHAR"
    ];
    public static readonly ruleNames = [
        "parse", "sql_stmt_list", "sql_stmt", "alter_table_stmt", "analyze_stmt", 
        "attach_stmt", "begin_stmt", "commit_stmt", "rollback_stmt", "savepoint_stmt", 
        "release_stmt", "create_index_stmt", "indexed_column", "create_table_stmt", 
        "table_options", "column_def", "type_name", "column_constraint", 
        "signed_number", "table_constraint", "foreign_key_clause", "conflict_clause", 
        "create_trigger_stmt", "create_view_stmt", "create_virtual_table_stmt", 
        "with_clause", "common_table_expression", "cte_table_name", "delete_stmt", 
        "detach_stmt", "drop_stmt", "expr", "expr_or", "expr_and", "expr_not", 
        "expr_binary", "expr_comparison", "expr_bitwise", "expr_addition", 
        "expr_multiplication", "expr_string", "expr_collate", "expr_unary", 
        "expr_base", "expr_recursive", "raise_function", "literal_value", 
        "percentile_clause", "value_row", "values_clause", "insert_stmt", 
        "returning_clause", "upsert_clause", "pragma_stmt", "pragma_value", 
        "reindex_stmt", "select_stmt", "join_clause", "join_step", "select_core", 
        "table_or_subquery", "result_column", "join_operator", "join_constraint", 
        "compound_operator", "update_stmt", "column_name_list", "qualified_table_name", 
        "vacuum_stmt", "filter_clause", "window_defn", "over_clause", "frame_spec", 
        "frame_clause", "order_clause", "limit_clause", "ordering_term", 
        "asc_desc", "frame_left", "frame_right", "frame_single", "error_message", 
        "filename", "module_argument", "module_argument_outer", "module_argument_inner", 
        "fallback_excluding_conflicts", "join_keyword", "fallback", "name", 
        "function_name", "schema_name", "table_name", "table_or_index_name", 
        "column_name", "column_name_excluding_string", "column_alias", "collation_name", 
        "foreign_table", "index_name", "trigger_name", "view_name", "module_name", 
        "pragma_name", "savepoint_name", "table_alias", "table_alias_excluding_joins", 
        "window_name", "alias", "base_window_name", "table_function_name", 
        "any_name_excluding_raise", "any_name_excluding_joins", "any_name_excluding_string", 
        "any_name",
    ];

    public get grammarFileName(): string { return "SqliteParser.g4"; }
    public get literalNames(): (string | null)[] { return SqliteParser.literalNames; }
    public get symbolicNames(): (string | null)[] { return SqliteParser.symbolicNames; }
    public get ruleNames(): string[] { return SqliteParser.ruleNames; }
    public get serializedATN(): number[] { return SqliteParser._serializedATN; }

    protected createFailedPredicateException(predicate?: string, message?: string): antlr.FailedPredicateException {
        return new antlr.FailedPredicateException(this, predicate, message);
    }

    public constructor(input: antlr.TokenStream) {
        super(input);
        this.interpreter = new antlr.ParserATNSimulator(this, SqliteParser._ATN, SqliteParser.decisionsToDFA, new antlr.PredictionContextCache());
    }
    public parse(): ParseContext {
        let localContext = new ParseContext(this.context, this.state);
        this.enterRule(localContext, 0, SqliteParser.RULE_parse);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 230;
            this.sql_stmt_list();
            this.state = 231;
            this.match(SqliteParser.EOF);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public sql_stmt_list(): Sql_stmt_listContext {
        let localContext = new Sql_stmt_listContext(this.context, this.state);
        this.enterRule(localContext, 2, SqliteParser.RULE_sql_stmt_list);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 234;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2149843525) !== 0) || ((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & 4169) !== 0) || _la === 100 || _la === 131 || ((((_la - 140)) & ~0x1F) === 0 && ((1 << (_la - 140)) & 3489667211) !== 0) || _la === 177) {
                {
                this.state = 233;
                this.sql_stmt();
                }
            }

            this.state = 242;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 1) {
                {
                {
                this.state = 236;
                this.match(SqliteParser.SCOL);
                this.state = 238;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 2149843525) !== 0) || ((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & 4169) !== 0) || _la === 100 || _la === 131 || ((((_la - 140)) & ~0x1F) === 0 && ((1 << (_la - 140)) & 3489667211) !== 0) || _la === 177) {
                    {
                    this.state = 237;
                    this.sql_stmt();
                    }
                }

                }
                }
                this.state = 244;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public sql_stmt(): Sql_stmtContext {
        let localContext = new Sql_stmtContext(this.context, this.state);
        this.enterRule(localContext, 4, SqliteParser.RULE_sql_stmt);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 250;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 77) {
                {
                this.state = 245;
                this.match(SqliteParser.EXPLAIN_);
                this.state = 248;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 134) {
                    {
                    this.state = 246;
                    this.match(SqliteParser.QUERY_);
                    this.state = 247;
                    this.match(SqliteParser.PLAN_);
                    }
                }

                }
            }

            this.state = 274;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 5, this.context) ) {
            case 1:
                {
                this.state = 252;
                this.alter_table_stmt();
                }
                break;
            case 2:
                {
                this.state = 253;
                this.analyze_stmt();
                }
                break;
            case 3:
                {
                this.state = 254;
                this.attach_stmt();
                }
                break;
            case 4:
                {
                this.state = 255;
                this.begin_stmt();
                }
                break;
            case 5:
                {
                this.state = 256;
                this.commit_stmt();
                }
                break;
            case 6:
                {
                this.state = 257;
                this.create_index_stmt();
                }
                break;
            case 7:
                {
                this.state = 258;
                this.create_table_stmt();
                }
                break;
            case 8:
                {
                this.state = 259;
                this.create_trigger_stmt();
                }
                break;
            case 9:
                {
                this.state = 260;
                this.create_view_stmt();
                }
                break;
            case 10:
                {
                this.state = 261;
                this.create_virtual_table_stmt();
                }
                break;
            case 11:
                {
                this.state = 262;
                this.delete_stmt();
                }
                break;
            case 12:
                {
                this.state = 263;
                this.detach_stmt();
                }
                break;
            case 13:
                {
                this.state = 264;
                this.drop_stmt();
                }
                break;
            case 14:
                {
                this.state = 265;
                this.insert_stmt();
                }
                break;
            case 15:
                {
                this.state = 266;
                this.pragma_stmt();
                }
                break;
            case 16:
                {
                this.state = 267;
                this.reindex_stmt();
                }
                break;
            case 17:
                {
                this.state = 268;
                this.release_stmt();
                }
                break;
            case 18:
                {
                this.state = 269;
                this.rollback_stmt();
                }
                break;
            case 19:
                {
                this.state = 270;
                this.savepoint_stmt();
                }
                break;
            case 20:
                {
                this.state = 271;
                this.select_stmt();
                }
                break;
            case 21:
                {
                this.state = 272;
                this.update_stmt();
                }
                break;
            case 22:
                {
                this.state = 273;
                this.vacuum_stmt();
                }
                break;
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public alter_table_stmt(): Alter_table_stmtContext {
        let localContext = new Alter_table_stmtContext(this.context, this.state);
        this.enterRule(localContext, 6, SqliteParser.RULE_alter_table_stmt);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 276;
            this.match(SqliteParser.ALTER_);
            this.state = 277;
            this.match(SqliteParser.TABLE_);
            this.state = 281;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 6, this.context) ) {
            case 1:
                {
                this.state = 278;
                this.schema_name();
                this.state = 279;
                this.match(SqliteParser.DOT);
                }
                break;
            }
            this.state = 283;
            this.table_name();
            this.state = 337;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.RENAME_:
                {
                this.state = 284;
                this.match(SqliteParser.RENAME_);
                this.state = 294;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case SqliteParser.TO_:
                    {
                    this.state = 285;
                    this.match(SqliteParser.TO_);
                    this.state = 286;
                    localContext._new_table_name = this.table_name();
                    }
                    break;
                case SqliteParser.ABORT_:
                case SqliteParser.ACTION_:
                case SqliteParser.AFTER_:
                case SqliteParser.ALWAYS_:
                case SqliteParser.ANALYZE_:
                case SqliteParser.ASC_:
                case SqliteParser.ATTACH_:
                case SqliteParser.BEFORE_:
                case SqliteParser.BEGIN_:
                case SqliteParser.BY_:
                case SqliteParser.CASCADE_:
                case SqliteParser.CAST_:
                case SqliteParser.COLUMN_:
                case SqliteParser.CONFLICT_:
                case SqliteParser.CROSS_:
                case SqliteParser.CURRENT_:
                case SqliteParser.CURRENT_DATE_:
                case SqliteParser.CURRENT_TIME_:
                case SqliteParser.CURRENT_TIMESTAMP_:
                case SqliteParser.DATABASE_:
                case SqliteParser.DEFERRED_:
                case SqliteParser.DESC_:
                case SqliteParser.DETACH_:
                case SqliteParser.DO_:
                case SqliteParser.EACH_:
                case SqliteParser.END_:
                case SqliteParser.EXCEPT_:
                case SqliteParser.EXCLUDE_:
                case SqliteParser.EXCLUSIVE_:
                case SqliteParser.EXPLAIN_:
                case SqliteParser.FAIL_:
                case SqliteParser.FALSE_:
                case SqliteParser.FIRST_:
                case SqliteParser.FOLLOWING_:
                case SqliteParser.FOR_:
                case SqliteParser.FULL_:
                case SqliteParser.GENERATED_:
                case SqliteParser.GLOB_:
                case SqliteParser.GROUPS_:
                case SqliteParser.IF_:
                case SqliteParser.IGNORE_:
                case SqliteParser.IMMEDIATE_:
                case SqliteParser.INDEXED_:
                case SqliteParser.INITIALLY_:
                case SqliteParser.INNER_:
                case SqliteParser.INSTEAD_:
                case SqliteParser.INTERSECT_:
                case SqliteParser.KEY_:
                case SqliteParser.LAST_:
                case SqliteParser.LEFT_:
                case SqliteParser.LIKE_:
                case SqliteParser.MATCH_:
                case SqliteParser.MATERIALIZED_:
                case SqliteParser.NATURAL_:
                case SqliteParser.NO_:
                case SqliteParser.NULLS_:
                case SqliteParser.OF_:
                case SqliteParser.OFFSET_:
                case SqliteParser.OTHERS_:
                case SqliteParser.OUTER_:
                case SqliteParser.PARTITION_:
                case SqliteParser.PLAN_:
                case SqliteParser.PRAGMA_:
                case SqliteParser.PRECEDING_:
                case SqliteParser.QUERY_:
                case SqliteParser.RAISE_:
                case SqliteParser.RANGE_:
                case SqliteParser.RECURSIVE_:
                case SqliteParser.REGEXP_:
                case SqliteParser.REINDEX_:
                case SqliteParser.RELEASE_:
                case SqliteParser.RENAME_:
                case SqliteParser.REPLACE_:
                case SqliteParser.RESTRICT_:
                case SqliteParser.RIGHT_:
                case SqliteParser.ROLLBACK_:
                case SqliteParser.ROW_:
                case SqliteParser.ROWID_:
                case SqliteParser.ROWS_:
                case SqliteParser.SAVEPOINT_:
                case SqliteParser.STORED_:
                case SqliteParser.STRICT_:
                case SqliteParser.TEMP_:
                case SqliteParser.TEMPORARY_:
                case SqliteParser.TIES_:
                case SqliteParser.TRIGGER_:
                case SqliteParser.TRUE_:
                case SqliteParser.UNBOUNDED_:
                case SqliteParser.UNION_:
                case SqliteParser.VACUUM_:
                case SqliteParser.VIEW_:
                case SqliteParser.VIRTUAL_:
                case SqliteParser.WITH_:
                case SqliteParser.WITHIN_:
                case SqliteParser.WITHOUT_:
                case SqliteParser.IDENTIFIER:
                case SqliteParser.STRING_LITERAL:
                    {
                    this.state = 288;
                    this.errorHandler.sync(this);
                    switch (this.interpreter.adaptivePredict(this.tokenStream, 7, this.context) ) {
                    case 1:
                        {
                        this.state = 287;
                        this.match(SqliteParser.COLUMN_);
                        }
                        break;
                    }
                    this.state = 290;
                    localContext._old_column_name = this.column_name();
                    this.state = 291;
                    this.match(SqliteParser.TO_);
                    this.state = 292;
                    localContext._new_column_name = this.column_name();
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                }
                break;
            case SqliteParser.ADD_:
                {
                this.state = 296;
                this.match(SqliteParser.ADD_);
                this.state = 310;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case SqliteParser.ABORT_:
                case SqliteParser.ACTION_:
                case SqliteParser.AFTER_:
                case SqliteParser.ALWAYS_:
                case SqliteParser.ANALYZE_:
                case SqliteParser.ASC_:
                case SqliteParser.ATTACH_:
                case SqliteParser.BEFORE_:
                case SqliteParser.BEGIN_:
                case SqliteParser.BY_:
                case SqliteParser.CASCADE_:
                case SqliteParser.CAST_:
                case SqliteParser.COLUMN_:
                case SqliteParser.CONFLICT_:
                case SqliteParser.CROSS_:
                case SqliteParser.CURRENT_:
                case SqliteParser.CURRENT_DATE_:
                case SqliteParser.CURRENT_TIME_:
                case SqliteParser.CURRENT_TIMESTAMP_:
                case SqliteParser.DATABASE_:
                case SqliteParser.DEFERRED_:
                case SqliteParser.DESC_:
                case SqliteParser.DETACH_:
                case SqliteParser.DO_:
                case SqliteParser.EACH_:
                case SqliteParser.END_:
                case SqliteParser.EXCEPT_:
                case SqliteParser.EXCLUDE_:
                case SqliteParser.EXCLUSIVE_:
                case SqliteParser.EXPLAIN_:
                case SqliteParser.FAIL_:
                case SqliteParser.FALSE_:
                case SqliteParser.FIRST_:
                case SqliteParser.FOLLOWING_:
                case SqliteParser.FOR_:
                case SqliteParser.FULL_:
                case SqliteParser.GENERATED_:
                case SqliteParser.GLOB_:
                case SqliteParser.GROUPS_:
                case SqliteParser.IF_:
                case SqliteParser.IGNORE_:
                case SqliteParser.IMMEDIATE_:
                case SqliteParser.INDEXED_:
                case SqliteParser.INITIALLY_:
                case SqliteParser.INNER_:
                case SqliteParser.INSTEAD_:
                case SqliteParser.INTERSECT_:
                case SqliteParser.KEY_:
                case SqliteParser.LAST_:
                case SqliteParser.LEFT_:
                case SqliteParser.LIKE_:
                case SqliteParser.MATCH_:
                case SqliteParser.MATERIALIZED_:
                case SqliteParser.NATURAL_:
                case SqliteParser.NO_:
                case SqliteParser.NULLS_:
                case SqliteParser.OF_:
                case SqliteParser.OFFSET_:
                case SqliteParser.OTHERS_:
                case SqliteParser.OUTER_:
                case SqliteParser.PARTITION_:
                case SqliteParser.PLAN_:
                case SqliteParser.PRAGMA_:
                case SqliteParser.PRECEDING_:
                case SqliteParser.QUERY_:
                case SqliteParser.RAISE_:
                case SqliteParser.RANGE_:
                case SqliteParser.RECURSIVE_:
                case SqliteParser.REGEXP_:
                case SqliteParser.REINDEX_:
                case SqliteParser.RELEASE_:
                case SqliteParser.RENAME_:
                case SqliteParser.REPLACE_:
                case SqliteParser.RESTRICT_:
                case SqliteParser.RIGHT_:
                case SqliteParser.ROLLBACK_:
                case SqliteParser.ROW_:
                case SqliteParser.ROWID_:
                case SqliteParser.ROWS_:
                case SqliteParser.SAVEPOINT_:
                case SqliteParser.STORED_:
                case SqliteParser.STRICT_:
                case SqliteParser.TEMP_:
                case SqliteParser.TEMPORARY_:
                case SqliteParser.TIES_:
                case SqliteParser.TRIGGER_:
                case SqliteParser.TRUE_:
                case SqliteParser.UNBOUNDED_:
                case SqliteParser.UNION_:
                case SqliteParser.VACUUM_:
                case SqliteParser.VIEW_:
                case SqliteParser.VIRTUAL_:
                case SqliteParser.WITH_:
                case SqliteParser.WITHIN_:
                case SqliteParser.WITHOUT_:
                case SqliteParser.IDENTIFIER:
                case SqliteParser.STRING_LITERAL:
                    {
                    this.state = 298;
                    this.errorHandler.sync(this);
                    switch (this.interpreter.adaptivePredict(this.tokenStream, 9, this.context) ) {
                    case 1:
                        {
                        this.state = 297;
                        this.match(SqliteParser.COLUMN_);
                        }
                        break;
                    }
                    this.state = 300;
                    this.column_def();
                    }
                    break;
                case SqliteParser.CHECK_:
                case SqliteParser.CONSTRAINT_:
                    {
                    this.state = 303;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 52) {
                        {
                        this.state = 301;
                        this.match(SqliteParser.CONSTRAINT_);
                        this.state = 302;
                        this.name();
                        }
                    }

                    this.state = 305;
                    this.match(SqliteParser.CHECK_);
                    {
                    this.state = 306;
                    this.expr();
                    }
                    this.state = 308;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 123) {
                        {
                        this.state = 307;
                        this.conflict_clause();
                        }
                    }

                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                }
                break;
            case SqliteParser.DROP_:
                {
                this.state = 312;
                this.match(SqliteParser.DROP_);
                this.state = 319;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case SqliteParser.ABORT_:
                case SqliteParser.ACTION_:
                case SqliteParser.AFTER_:
                case SqliteParser.ALWAYS_:
                case SqliteParser.ANALYZE_:
                case SqliteParser.ASC_:
                case SqliteParser.ATTACH_:
                case SqliteParser.BEFORE_:
                case SqliteParser.BEGIN_:
                case SqliteParser.BY_:
                case SqliteParser.CASCADE_:
                case SqliteParser.CAST_:
                case SqliteParser.COLUMN_:
                case SqliteParser.CONFLICT_:
                case SqliteParser.CROSS_:
                case SqliteParser.CURRENT_:
                case SqliteParser.CURRENT_DATE_:
                case SqliteParser.CURRENT_TIME_:
                case SqliteParser.CURRENT_TIMESTAMP_:
                case SqliteParser.DATABASE_:
                case SqliteParser.DEFERRED_:
                case SqliteParser.DESC_:
                case SqliteParser.DETACH_:
                case SqliteParser.DO_:
                case SqliteParser.EACH_:
                case SqliteParser.END_:
                case SqliteParser.EXCEPT_:
                case SqliteParser.EXCLUDE_:
                case SqliteParser.EXCLUSIVE_:
                case SqliteParser.EXPLAIN_:
                case SqliteParser.FAIL_:
                case SqliteParser.FALSE_:
                case SqliteParser.FIRST_:
                case SqliteParser.FOLLOWING_:
                case SqliteParser.FOR_:
                case SqliteParser.FULL_:
                case SqliteParser.GENERATED_:
                case SqliteParser.GLOB_:
                case SqliteParser.GROUPS_:
                case SqliteParser.IF_:
                case SqliteParser.IGNORE_:
                case SqliteParser.IMMEDIATE_:
                case SqliteParser.INDEXED_:
                case SqliteParser.INITIALLY_:
                case SqliteParser.INNER_:
                case SqliteParser.INSTEAD_:
                case SqliteParser.INTERSECT_:
                case SqliteParser.KEY_:
                case SqliteParser.LAST_:
                case SqliteParser.LEFT_:
                case SqliteParser.LIKE_:
                case SqliteParser.MATCH_:
                case SqliteParser.MATERIALIZED_:
                case SqliteParser.NATURAL_:
                case SqliteParser.NO_:
                case SqliteParser.NULLS_:
                case SqliteParser.OF_:
                case SqliteParser.OFFSET_:
                case SqliteParser.OTHERS_:
                case SqliteParser.OUTER_:
                case SqliteParser.PARTITION_:
                case SqliteParser.PLAN_:
                case SqliteParser.PRAGMA_:
                case SqliteParser.PRECEDING_:
                case SqliteParser.QUERY_:
                case SqliteParser.RAISE_:
                case SqliteParser.RANGE_:
                case SqliteParser.RECURSIVE_:
                case SqliteParser.REGEXP_:
                case SqliteParser.REINDEX_:
                case SqliteParser.RELEASE_:
                case SqliteParser.RENAME_:
                case SqliteParser.REPLACE_:
                case SqliteParser.RESTRICT_:
                case SqliteParser.RIGHT_:
                case SqliteParser.ROLLBACK_:
                case SqliteParser.ROW_:
                case SqliteParser.ROWID_:
                case SqliteParser.ROWS_:
                case SqliteParser.SAVEPOINT_:
                case SqliteParser.STORED_:
                case SqliteParser.STRICT_:
                case SqliteParser.TEMP_:
                case SqliteParser.TEMPORARY_:
                case SqliteParser.TIES_:
                case SqliteParser.TRIGGER_:
                case SqliteParser.TRUE_:
                case SqliteParser.UNBOUNDED_:
                case SqliteParser.UNION_:
                case SqliteParser.VACUUM_:
                case SqliteParser.VIEW_:
                case SqliteParser.VIRTUAL_:
                case SqliteParser.WITH_:
                case SqliteParser.WITHIN_:
                case SqliteParser.WITHOUT_:
                case SqliteParser.IDENTIFIER:
                case SqliteParser.STRING_LITERAL:
                    {
                    this.state = 314;
                    this.errorHandler.sync(this);
                    switch (this.interpreter.adaptivePredict(this.tokenStream, 13, this.context) ) {
                    case 1:
                        {
                        this.state = 313;
                        this.match(SqliteParser.COLUMN_);
                        }
                        break;
                    }
                    this.state = 316;
                    this.column_name();
                    }
                    break;
                case SqliteParser.CONSTRAINT_:
                    {
                    this.state = 317;
                    this.match(SqliteParser.CONSTRAINT_);
                    this.state = 318;
                    this.name();
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                }
                break;
            case SqliteParser.ALTER_:
                {
                this.state = 321;
                this.match(SqliteParser.ALTER_);
                this.state = 323;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 15, this.context) ) {
                case 1:
                    {
                    this.state = 322;
                    this.match(SqliteParser.COLUMN_);
                    }
                    break;
                }
                this.state = 325;
                this.column_name();
                this.state = 335;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case SqliteParser.SET_:
                    {
                    {
                    this.state = 326;
                    this.match(SqliteParser.SET_);
                    this.state = 327;
                    this.match(SqliteParser.NOT_);
                    this.state = 328;
                    this.match(SqliteParser.NULL_);
                    this.state = 330;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 123) {
                        {
                        this.state = 329;
                        this.conflict_clause();
                        }
                    }

                    }
                    }
                    break;
                case SqliteParser.DROP_:
                    {
                    {
                    this.state = 332;
                    this.match(SqliteParser.DROP_);
                    this.state = 333;
                    this.match(SqliteParser.NOT_);
                    this.state = 334;
                    this.match(SqliteParser.NULL_);
                    }
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public analyze_stmt(): Analyze_stmtContext {
        let localContext = new Analyze_stmtContext(this.context, this.state);
        this.enterRule(localContext, 8, SqliteParser.RULE_analyze_stmt);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 339;
            this.match(SqliteParser.ANALYZE_);
            this.state = 347;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 20, this.context) ) {
            case 1:
                {
                this.state = 340;
                this.schema_name();
                }
                break;
            case 2:
                {
                this.state = 344;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 19, this.context) ) {
                case 1:
                    {
                    this.state = 341;
                    this.schema_name();
                    this.state = 342;
                    this.match(SqliteParser.DOT);
                    }
                    break;
                }
                this.state = 346;
                this.table_or_index_name();
                }
                break;
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public attach_stmt(): Attach_stmtContext {
        let localContext = new Attach_stmtContext(this.context, this.state);
        this.enterRule(localContext, 10, SqliteParser.RULE_attach_stmt);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 349;
            this.match(SqliteParser.ATTACH_);
            this.state = 351;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 21, this.context) ) {
            case 1:
                {
                this.state = 350;
                this.match(SqliteParser.DATABASE_);
                }
                break;
            }
            this.state = 353;
            this.expr();
            this.state = 354;
            this.match(SqliteParser.AS_);
            this.state = 355;
            this.schema_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public begin_stmt(): Begin_stmtContext {
        let localContext = new Begin_stmtContext(this.context, this.state);
        this.enterRule(localContext, 12, SqliteParser.RULE_begin_stmt);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 357;
            this.match(SqliteParser.BEGIN_);
            this.state = 359;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 62 || _la === 75 || _la === 94) {
                {
                this.state = 358;
                _la = this.tokenStream.LA(1);
                if(!(_la === 62 || _la === 75 || _la === 94)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                }
            }

            this.state = 362;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 162) {
                {
                this.state = 361;
                this.match(SqliteParser.TRANSACTION_);
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public commit_stmt(): Commit_stmtContext {
        let localContext = new Commit_stmtContext(this.context, this.state);
        this.enterRule(localContext, 14, SqliteParser.RULE_commit_stmt);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 364;
            _la = this.tokenStream.LA(1);
            if(!(_la === 50 || _la === 71)) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            this.state = 366;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 162) {
                {
                this.state = 365;
                this.match(SqliteParser.TRANSACTION_);
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public rollback_stmt(): Rollback_stmtContext {
        let localContext = new Rollback_stmtContext(this.context, this.state);
        this.enterRule(localContext, 16, SqliteParser.RULE_rollback_stmt);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 368;
            this.match(SqliteParser.ROLLBACK_);
            this.state = 370;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 162) {
                {
                this.state = 369;
                this.match(SqliteParser.TRANSACTION_);
                }
            }

            this.state = 377;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 161) {
                {
                this.state = 372;
                this.match(SqliteParser.TO_);
                this.state = 374;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 26, this.context) ) {
                case 1:
                    {
                    this.state = 373;
                    this.match(SqliteParser.SAVEPOINT_);
                    }
                    break;
                }
                this.state = 376;
                this.savepoint_name();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public savepoint_stmt(): Savepoint_stmtContext {
        let localContext = new Savepoint_stmtContext(this.context, this.state);
        this.enterRule(localContext, 18, SqliteParser.RULE_savepoint_stmt);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 379;
            this.match(SqliteParser.SAVEPOINT_);
            this.state = 380;
            this.savepoint_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public release_stmt(): Release_stmtContext {
        let localContext = new Release_stmtContext(this.context, this.state);
        this.enterRule(localContext, 20, SqliteParser.RULE_release_stmt);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 382;
            this.match(SqliteParser.RELEASE_);
            this.state = 384;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 28, this.context) ) {
            case 1:
                {
                this.state = 383;
                this.match(SqliteParser.SAVEPOINT_);
                }
                break;
            }
            this.state = 386;
            this.savepoint_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public create_index_stmt(): Create_index_stmtContext {
        let localContext = new Create_index_stmtContext(this.context, this.state);
        this.enterRule(localContext, 22, SqliteParser.RULE_create_index_stmt);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 388;
            this.match(SqliteParser.CREATE_);
            this.state = 390;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 167) {
                {
                this.state = 389;
                this.match(SqliteParser.UNIQUE_);
                }
            }

            this.state = 392;
            this.match(SqliteParser.INDEX_);
            this.state = 396;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 30, this.context) ) {
            case 1:
                {
                this.state = 393;
                this.match(SqliteParser.IF_);
                this.state = 394;
                this.match(SqliteParser.NOT_);
                this.state = 395;
                this.match(SqliteParser.EXISTS_);
                }
                break;
            }
            this.state = 401;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 31, this.context) ) {
            case 1:
                {
                this.state = 398;
                this.schema_name();
                this.state = 399;
                this.match(SqliteParser.DOT);
                }
                break;
            }
            this.state = 403;
            this.index_name();
            this.state = 404;
            this.match(SqliteParser.ON_);
            this.state = 405;
            this.table_name();
            this.state = 406;
            this.match(SqliteParser.OPEN_PAR);
            this.state = 407;
            this.indexed_column();
            this.state = 412;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 5) {
                {
                {
                this.state = 408;
                this.match(SqliteParser.COMMA);
                this.state = 409;
                this.indexed_column();
                }
                }
                this.state = 414;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 415;
            this.match(SqliteParser.CLOSE_PAR);
            this.state = 418;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 175) {
                {
                this.state = 416;
                this.match(SqliteParser.WHERE_);
                this.state = 417;
                this.expr();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public indexed_column(): Indexed_columnContext {
        let localContext = new Indexed_columnContext(this.context, this.state);
        this.enterRule(localContext, 24, SqliteParser.RULE_indexed_column);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 420;
            this.expr();
            this.state = 423;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 48) {
                {
                this.state = 421;
                this.match(SqliteParser.COLLATE_);
                this.state = 422;
                this.collation_name();
                }
            }

            this.state = 426;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 37 || _la === 64) {
                {
                this.state = 425;
                this.asc_desc();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public create_table_stmt(): Create_table_stmtContext {
        let localContext = new Create_table_stmtContext(this.context, this.state);
        this.enterRule(localContext, 26, SqliteParser.RULE_create_table_stmt);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 428;
            this.match(SqliteParser.CREATE_);
            this.state = 430;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 157 || _la === 158) {
                {
                this.state = 429;
                _la = this.tokenStream.LA(1);
                if(!(_la === 157 || _la === 158)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                }
            }

            this.state = 432;
            this.match(SqliteParser.TABLE_);
            this.state = 436;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 37, this.context) ) {
            case 1:
                {
                this.state = 433;
                this.match(SqliteParser.IF_);
                this.state = 434;
                this.match(SqliteParser.NOT_);
                this.state = 435;
                this.match(SqliteParser.EXISTS_);
                }
                break;
            }
            this.state = 441;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 38, this.context) ) {
            case 1:
                {
                this.state = 438;
                this.schema_name();
                this.state = 439;
                this.match(SqliteParser.DOT);
                }
                break;
            }
            this.state = 443;
            this.table_name();
            this.state = 466;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.OPEN_PAR:
                {
                this.state = 444;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 445;
                this.column_def();
                this.state = 450;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 39, this.context);
                while (alternative !== 1 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1 + 1) {
                        {
                        {
                        this.state = 446;
                        this.match(SqliteParser.COMMA);
                        this.state = 447;
                        this.column_def();
                        }
                        }
                    }
                    this.state = 452;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 39, this.context);
                }
                this.state = 457;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 5) {
                    {
                    {
                    this.state = 453;
                    this.match(SqliteParser.COMMA);
                    this.state = 454;
                    this.table_constraint();
                    }
                    }
                    this.state = 459;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 460;
                this.match(SqliteParser.CLOSE_PAR);
                this.state = 462;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 155 || _la === 179) {
                    {
                    this.state = 461;
                    this.table_options();
                    }
                }

                }
                break;
            case SqliteParser.AS_:
                {
                this.state = 464;
                this.match(SqliteParser.AS_);
                this.state = 465;
                this.select_stmt();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public table_options(): Table_optionsContext {
        let localContext = new Table_optionsContext(this.context, this.state);
        this.enterRule(localContext, 28, SqliteParser.RULE_table_options);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 471;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.WITHOUT_:
                {
                this.state = 468;
                this.match(SqliteParser.WITHOUT_);
                this.state = 469;
                this.match(SqliteParser.ROWID_);
                }
                break;
            case SqliteParser.STRICT_:
                {
                this.state = 470;
                this.match(SqliteParser.STRICT_);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            this.state = 481;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 5) {
                {
                {
                this.state = 473;
                this.match(SqliteParser.COMMA);
                this.state = 477;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case SqliteParser.WITHOUT_:
                    {
                    this.state = 474;
                    this.match(SqliteParser.WITHOUT_);
                    this.state = 475;
                    this.match(SqliteParser.ROWID_);
                    }
                    break;
                case SqliteParser.STRICT_:
                    {
                    this.state = 476;
                    this.match(SqliteParser.STRICT_);
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                }
                }
                this.state = 483;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public column_def(): Column_defContext {
        let localContext = new Column_defContext(this.context, this.state);
        this.enterRule(localContext, 30, SqliteParser.RULE_column_def);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 484;
            this.column_name();
            this.state = 486;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 46, this.context) ) {
            case 1:
                {
                this.state = 485;
                this.type_name();
                }
                break;
            }
            this.state = 491;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & 16848897) !== 0) || _la === 87 || _la === 116 || ((((_la - 119)) & ~0x1F) === 0 && ((1 << (_la - 119)) & 540673) !== 0) || _la === 167) {
                {
                {
                this.state = 488;
                this.column_constraint();
                }
                }
                this.state = 493;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public type_name(): Type_nameContext {
        let localContext = new Type_nameContext(this.context, this.state);
        this.enterRule(localContext, 32, SqliteParser.RULE_type_name);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 495;
            this.errorHandler.sync(this);
            alternative = 1 + 1;
            do {
                switch (alternative) {
                case 1 + 1:
                    {
                    {
                    this.state = 494;
                    this.name();
                    }
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                this.state = 497;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 48, this.context);
            } while (alternative !== 1 && alternative !== antlr.ATN.INVALID_ALT_NUMBER);
            this.state = 509;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 49, this.context) ) {
            case 1:
                {
                this.state = 499;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 500;
                this.signed_number();
                this.state = 501;
                this.match(SqliteParser.CLOSE_PAR);
                }
                break;
            case 2:
                {
                this.state = 503;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 504;
                this.signed_number();
                this.state = 505;
                this.match(SqliteParser.COMMA);
                this.state = 506;
                this.signed_number();
                this.state = 507;
                this.match(SqliteParser.CLOSE_PAR);
                }
                break;
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public column_constraint(): Column_constraintContext {
        let localContext = new Column_constraintContext(this.context, this.state);
        this.enterRule(localContext, 34, SqliteParser.RULE_column_constraint);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 513;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 52) {
                {
                this.state = 511;
                this.match(SqliteParser.CONSTRAINT_);
                this.state = 512;
                this.name();
                }
            }

            this.state = 564;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.PRIMARY_:
                {
                this.state = 515;
                this.match(SqliteParser.PRIMARY_);
                this.state = 516;
                this.match(SqliteParser.KEY_);
                this.state = 518;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 37 || _la === 64) {
                    {
                    this.state = 517;
                    this.asc_desc();
                    }
                }

                this.state = 521;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 123) {
                    {
                    this.state = 520;
                    this.conflict_clause();
                    }
                }

                this.state = 524;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 39) {
                    {
                    this.state = 523;
                    this.match(SqliteParser.AUTOINCREMENT_);
                    }
                }

                }
                break;
            case SqliteParser.NOT_:
            case SqliteParser.NULL_:
            case SqliteParser.UNIQUE_:
                {
                this.state = 531;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case SqliteParser.NOT_:
                case SqliteParser.NULL_:
                    {
                    this.state = 527;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 116) {
                        {
                        this.state = 526;
                        this.match(SqliteParser.NOT_);
                        }
                    }

                    this.state = 529;
                    this.match(SqliteParser.NULL_);
                    }
                    break;
                case SqliteParser.UNIQUE_:
                    {
                    this.state = 530;
                    this.match(SqliteParser.UNIQUE_);
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                this.state = 534;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 123) {
                    {
                    this.state = 533;
                    this.conflict_clause();
                    }
                }

                }
                break;
            case SqliteParser.CHECK_:
                {
                this.state = 536;
                this.match(SqliteParser.CHECK_);
                this.state = 537;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 538;
                this.expr();
                this.state = 539;
                this.match(SqliteParser.CLOSE_PAR);
                }
                break;
            case SqliteParser.DEFAULT_:
                {
                this.state = 541;
                this.match(SqliteParser.DEFAULT_);
                this.state = 548;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 57, this.context) ) {
                case 1:
                    {
                    this.state = 542;
                    this.signed_number();
                    }
                    break;
                case 2:
                    {
                    this.state = 543;
                    this.literal_value();
                    }
                    break;
                case 3:
                    {
                    this.state = 544;
                    this.match(SqliteParser.OPEN_PAR);
                    this.state = 545;
                    this.expr();
                    this.state = 546;
                    this.match(SqliteParser.CLOSE_PAR);
                    }
                    break;
                }
                }
                break;
            case SqliteParser.COLLATE_:
                {
                this.state = 550;
                this.match(SqliteParser.COLLATE_);
                this.state = 551;
                this.collation_name();
                }
                break;
            case SqliteParser.REFERENCES_:
                {
                this.state = 552;
                this.foreign_key_clause();
                }
                break;
            case SqliteParser.AS_:
            case SqliteParser.GENERATED_:
                {
                this.state = 555;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 87) {
                    {
                    this.state = 553;
                    this.match(SqliteParser.GENERATED_);
                    this.state = 554;
                    this.match(SqliteParser.ALWAYS_);
                    }
                }

                this.state = 557;
                this.match(SqliteParser.AS_);
                this.state = 558;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 559;
                this.expr();
                this.state = 560;
                this.match(SqliteParser.CLOSE_PAR);
                this.state = 562;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 154 || _la === 173) {
                    {
                    this.state = 561;
                    _la = this.tokenStream.LA(1);
                    if(!(_la === 154 || _la === 173)) {
                    this.errorHandler.recoverInline(this);
                    }
                    else {
                        this.errorHandler.reportMatch(this);
                        this.consume();
                    }
                    }
                }

                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public signed_number(): Signed_numberContext {
        let localContext = new Signed_numberContext(this.context, this.state);
        this.enterRule(localContext, 36, SqliteParser.RULE_signed_number);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 567;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 8 || _la === 9) {
                {
                this.state = 566;
                _la = this.tokenStream.LA(1);
                if(!(_la === 8 || _la === 9)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                }
            }

            this.state = 569;
            this.match(SqliteParser.NUMERIC_LITERAL);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public table_constraint(): Table_constraintContext {
        let localContext = new Table_constraintContext(this.context, this.state);
        this.enterRule(localContext, 38, SqliteParser.RULE_table_constraint);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 573;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 52) {
                {
                this.state = 571;
                this.match(SqliteParser.CONSTRAINT_);
                this.state = 572;
                this.name();
                }
            }

            this.state = 612;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.PRIMARY_:
            case SqliteParser.UNIQUE_:
                {
                this.state = 578;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case SqliteParser.PRIMARY_:
                    {
                    this.state = 575;
                    this.match(SqliteParser.PRIMARY_);
                    this.state = 576;
                    this.match(SqliteParser.KEY_);
                    }
                    break;
                case SqliteParser.UNIQUE_:
                    {
                    this.state = 577;
                    this.match(SqliteParser.UNIQUE_);
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                this.state = 580;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 581;
                this.indexed_column();
                this.state = 586;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 5) {
                    {
                    {
                    this.state = 582;
                    this.match(SqliteParser.COMMA);
                    this.state = 583;
                    this.indexed_column();
                    }
                    }
                    this.state = 588;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 589;
                this.match(SqliteParser.CLOSE_PAR);
                this.state = 591;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 123) {
                    {
                    this.state = 590;
                    this.conflict_clause();
                    }
                }

                }
                break;
            case SqliteParser.CHECK_:
                {
                this.state = 593;
                this.match(SqliteParser.CHECK_);
                this.state = 594;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 595;
                this.expr();
                this.state = 596;
                this.match(SqliteParser.CLOSE_PAR);
                }
                break;
            case SqliteParser.FOREIGN_:
                {
                this.state = 598;
                this.match(SqliteParser.FOREIGN_);
                this.state = 599;
                this.match(SqliteParser.KEY_);
                this.state = 600;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 601;
                this.column_name();
                this.state = 606;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 5) {
                    {
                    {
                    this.state = 602;
                    this.match(SqliteParser.COMMA);
                    this.state = 603;
                    this.column_name();
                    }
                    }
                    this.state = 608;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 609;
                this.match(SqliteParser.CLOSE_PAR);
                this.state = 610;
                this.foreign_key_clause();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public foreign_key_clause(): Foreign_key_clauseContext {
        let localContext = new Foreign_key_clauseContext(this.context, this.state);
        this.enterRule(localContext, 40, SqliteParser.RULE_foreign_key_clause);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 614;
            this.match(SqliteParser.REFERENCES_);
            this.state = 615;
            this.foreign_table();
            this.state = 627;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 3) {
                {
                this.state = 616;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 617;
                this.column_name();
                this.state = 622;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 5) {
                    {
                    {
                    this.state = 618;
                    this.match(SqliteParser.COMMA);
                    this.state = 619;
                    this.column_name();
                    }
                    }
                    this.state = 624;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 625;
                this.match(SqliteParser.CLOSE_PAR);
                }
            }

            this.state = 643;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 112 || _la === 123) {
                {
                this.state = 641;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case SqliteParser.ON_:
                    {
                    this.state = 629;
                    this.match(SqliteParser.ON_);
                    this.state = 630;
                    _la = this.tokenStream.LA(1);
                    if(!(_la === 63 || _la === 168)) {
                    this.errorHandler.recoverInline(this);
                    }
                    else {
                        this.errorHandler.reportMatch(this);
                        this.consume();
                    }
                    this.state = 637;
                    this.errorHandler.sync(this);
                    switch (this.tokenStream.LA(1)) {
                    case SqliteParser.SET_:
                        {
                        this.state = 631;
                        this.match(SqliteParser.SET_);
                        this.state = 632;
                        _la = this.tokenStream.LA(1);
                        if(!(_la === 60 || _la === 119)) {
                        this.errorHandler.recoverInline(this);
                        }
                        else {
                            this.errorHandler.reportMatch(this);
                            this.consume();
                        }
                        }
                        break;
                    case SqliteParser.CASCADE_:
                        {
                        this.state = 633;
                        this.match(SqliteParser.CASCADE_);
                        }
                        break;
                    case SqliteParser.RESTRICT_:
                        {
                        this.state = 634;
                        this.match(SqliteParser.RESTRICT_);
                        }
                        break;
                    case SqliteParser.NO_:
                        {
                        this.state = 635;
                        this.match(SqliteParser.NO_);
                        this.state = 636;
                        this.match(SqliteParser.ACTION_);
                        }
                        break;
                    default:
                        throw new antlr.NoViableAltException(this);
                    }
                    }
                    break;
                case SqliteParser.MATCH_:
                    {
                    this.state = 639;
                    this.match(SqliteParser.MATCH_);
                    this.state = 640;
                    this.name();
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                }
                this.state = 645;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 654;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 75, this.context) ) {
            case 1:
                {
                this.state = 647;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 116) {
                    {
                    this.state = 646;
                    this.match(SqliteParser.NOT_);
                    }
                }

                this.state = 649;
                this.match(SqliteParser.DEFERRABLE_);
                this.state = 652;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 98) {
                    {
                    this.state = 650;
                    this.match(SqliteParser.INITIALLY_);
                    this.state = 651;
                    _la = this.tokenStream.LA(1);
                    if(!(_la === 62 || _la === 94)) {
                    this.errorHandler.recoverInline(this);
                    }
                    else {
                        this.errorHandler.reportMatch(this);
                        this.consume();
                    }
                    }
                }

                }
                break;
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public conflict_clause(): Conflict_clauseContext {
        let localContext = new Conflict_clauseContext(this.context, this.state);
        this.enterRule(localContext, 42, SqliteParser.RULE_conflict_clause);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 656;
            this.match(SqliteParser.ON_);
            this.state = 657;
            this.match(SqliteParser.CONFLICT_);
            this.state = 658;
            _la = this.tokenStream.LA(1);
            if(!(_la === 27 || _la === 78 || _la === 93 || _la === 143 || _la === 147)) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public create_trigger_stmt(): Create_trigger_stmtContext {
        let localContext = new Create_trigger_stmtContext(this.context, this.state);
        this.enterRule(localContext, 44, SqliteParser.RULE_create_trigger_stmt);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 660;
            this.match(SqliteParser.CREATE_);
            this.state = 662;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 157 || _la === 158) {
                {
                this.state = 661;
                _la = this.tokenStream.LA(1);
                if(!(_la === 157 || _la === 158)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                }
            }

            this.state = 664;
            this.match(SqliteParser.TRIGGER_);
            this.state = 668;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 77, this.context) ) {
            case 1:
                {
                this.state = 665;
                this.match(SqliteParser.IF_);
                this.state = 666;
                this.match(SqliteParser.NOT_);
                this.state = 667;
                this.match(SqliteParser.EXISTS_);
                }
                break;
            }
            this.state = 673;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 78, this.context) ) {
            case 1:
                {
                this.state = 670;
                this.schema_name();
                this.state = 671;
                this.match(SqliteParser.DOT);
                }
                break;
            }
            this.state = 675;
            this.trigger_name();
            this.state = 680;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.BEFORE_:
                {
                this.state = 676;
                this.match(SqliteParser.BEFORE_);
                }
                break;
            case SqliteParser.AFTER_:
                {
                this.state = 677;
                this.match(SqliteParser.AFTER_);
                }
                break;
            case SqliteParser.INSTEAD_:
                {
                this.state = 678;
                this.match(SqliteParser.INSTEAD_);
                this.state = 679;
                this.match(SqliteParser.OF_);
                }
                break;
            case SqliteParser.DELETE_:
            case SqliteParser.INSERT_:
            case SqliteParser.UPDATE_:
                break;
            default:
                break;
            }
            this.state = 696;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.DELETE_:
                {
                this.state = 682;
                this.match(SqliteParser.DELETE_);
                }
                break;
            case SqliteParser.INSERT_:
                {
                this.state = 683;
                this.match(SqliteParser.INSERT_);
                }
                break;
            case SqliteParser.UPDATE_:
                {
                this.state = 684;
                this.match(SqliteParser.UPDATE_);
                this.state = 694;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 121) {
                    {
                    this.state = 685;
                    this.match(SqliteParser.OF_);
                    this.state = 686;
                    this.column_name();
                    this.state = 691;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    while (_la === 5) {
                        {
                        {
                        this.state = 687;
                        this.match(SqliteParser.COMMA);
                        this.state = 688;
                        this.column_name();
                        }
                        }
                        this.state = 693;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                    }
                    }
                }

                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            this.state = 698;
            this.match(SqliteParser.ON_);
            this.state = 699;
            this.table_name();
            this.state = 703;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 83) {
                {
                this.state = 700;
                this.match(SqliteParser.FOR_);
                this.state = 701;
                this.match(SqliteParser.EACH_);
                this.state = 702;
                this.match(SqliteParser.ROW_);
                }
            }

            this.state = 707;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 174) {
                {
                this.state = 705;
                this.match(SqliteParser.WHEN_);
                this.state = 706;
                this.expr();
                }
            }

            this.state = 709;
            this.match(SqliteParser.BEGIN_);
            this.state = 718;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 714;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 85, this.context) ) {
                case 1:
                    {
                    this.state = 710;
                    this.update_stmt();
                    }
                    break;
                case 2:
                    {
                    this.state = 711;
                    this.insert_stmt();
                    }
                    break;
                case 3:
                    {
                    this.state = 712;
                    this.delete_stmt();
                    }
                    break;
                case 4:
                    {
                    this.state = 713;
                    this.select_stmt();
                    }
                    break;
                }
                this.state = 716;
                this.match(SqliteParser.SCOL);
                }
                }
                this.state = 720;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while (_la === 63 || _la === 100 || ((((_la - 143)) & ~0x1F) === 0 && ((1 << (_la - 143)) & 301990401) !== 0) || _la === 177);
            this.state = 722;
            this.match(SqliteParser.END_);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public create_view_stmt(): Create_view_stmtContext {
        let localContext = new Create_view_stmtContext(this.context, this.state);
        this.enterRule(localContext, 46, SqliteParser.RULE_create_view_stmt);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 724;
            this.match(SqliteParser.CREATE_);
            this.state = 726;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 157 || _la === 158) {
                {
                this.state = 725;
                _la = this.tokenStream.LA(1);
                if(!(_la === 157 || _la === 158)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                }
            }

            this.state = 728;
            this.match(SqliteParser.VIEW_);
            this.state = 732;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 88, this.context) ) {
            case 1:
                {
                this.state = 729;
                this.match(SqliteParser.IF_);
                this.state = 730;
                this.match(SqliteParser.NOT_);
                this.state = 731;
                this.match(SqliteParser.EXISTS_);
                }
                break;
            }
            this.state = 737;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 89, this.context) ) {
            case 1:
                {
                this.state = 734;
                this.schema_name();
                this.state = 735;
                this.match(SqliteParser.DOT);
                }
                break;
            }
            this.state = 739;
            this.view_name();
            this.state = 751;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 3) {
                {
                this.state = 740;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 741;
                this.column_name();
                this.state = 746;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 5) {
                    {
                    {
                    this.state = 742;
                    this.match(SqliteParser.COMMA);
                    this.state = 743;
                    this.column_name();
                    }
                    }
                    this.state = 748;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 749;
                this.match(SqliteParser.CLOSE_PAR);
                }
            }

            this.state = 753;
            this.match(SqliteParser.AS_);
            this.state = 754;
            this.select_stmt();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public create_virtual_table_stmt(): Create_virtual_table_stmtContext {
        let localContext = new Create_virtual_table_stmtContext(this.context, this.state);
        this.enterRule(localContext, 48, SqliteParser.RULE_create_virtual_table_stmt);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 756;
            this.match(SqliteParser.CREATE_);
            this.state = 757;
            this.match(SqliteParser.VIRTUAL_);
            this.state = 758;
            this.match(SqliteParser.TABLE_);
            this.state = 762;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 92, this.context) ) {
            case 1:
                {
                this.state = 759;
                this.match(SqliteParser.IF_);
                this.state = 760;
                this.match(SqliteParser.NOT_);
                this.state = 761;
                this.match(SqliteParser.EXISTS_);
                }
                break;
            }
            this.state = 767;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 93, this.context) ) {
            case 1:
                {
                this.state = 764;
                this.schema_name();
                this.state = 765;
                this.match(SqliteParser.DOT);
                }
                break;
            }
            this.state = 769;
            this.table_name();
            this.state = 770;
            this.match(SqliteParser.USING_);
            this.state = 771;
            this.module_name();
            this.state = 783;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 3) {
                {
                this.state = 772;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 773;
                this.module_argument();
                this.state = 778;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 5) {
                    {
                    {
                    this.state = 774;
                    this.match(SqliteParser.COMMA);
                    this.state = 775;
                    this.module_argument();
                    }
                    }
                    this.state = 780;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 781;
                this.match(SqliteParser.CLOSE_PAR);
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public with_clause(): With_clauseContext {
        let localContext = new With_clauseContext(this.context, this.state);
        this.enterRule(localContext, 50, SqliteParser.RULE_with_clause);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 785;
            this.match(SqliteParser.WITH_);
            this.state = 787;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 96, this.context) ) {
            case 1:
                {
                this.state = 786;
                this.match(SqliteParser.RECURSIVE_);
                }
                break;
            }
            this.state = 789;
            this.common_table_expression();
            this.state = 794;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 5) {
                {
                {
                this.state = 790;
                this.match(SqliteParser.COMMA);
                this.state = 791;
                this.common_table_expression();
                }
                }
                this.state = 796;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public common_table_expression(): Common_table_expressionContext {
        let localContext = new Common_table_expressionContext(this.context, this.state);
        this.enterRule(localContext, 52, SqliteParser.RULE_common_table_expression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 797;
            this.cte_table_name();
            this.state = 798;
            this.match(SqliteParser.AS_);
            this.state = 803;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 113 || _la === 116) {
                {
                this.state = 800;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 116) {
                    {
                    this.state = 799;
                    this.match(SqliteParser.NOT_);
                    }
                }

                this.state = 802;
                this.match(SqliteParser.MATERIALIZED_);
                }
            }

            this.state = 805;
            this.match(SqliteParser.OPEN_PAR);
            this.state = 806;
            this.select_stmt();
            this.state = 807;
            this.match(SqliteParser.CLOSE_PAR);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public cte_table_name(): Cte_table_nameContext {
        let localContext = new Cte_table_nameContext(this.context, this.state);
        this.enterRule(localContext, 54, SqliteParser.RULE_cte_table_name);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 809;
            this.table_name();
            this.state = 821;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 3) {
                {
                this.state = 810;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 811;
                this.column_name();
                this.state = 816;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 5) {
                    {
                    {
                    this.state = 812;
                    this.match(SqliteParser.COMMA);
                    this.state = 813;
                    this.column_name();
                    }
                    }
                    this.state = 818;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 819;
                this.match(SqliteParser.CLOSE_PAR);
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public delete_stmt(): Delete_stmtContext {
        let localContext = new Delete_stmtContext(this.context, this.state);
        this.enterRule(localContext, 56, SqliteParser.RULE_delete_stmt);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 824;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 177) {
                {
                this.state = 823;
                this.with_clause();
                }
            }

            this.state = 826;
            this.match(SqliteParser.DELETE_);
            this.state = 827;
            this.match(SqliteParser.FROM_);
            this.state = 828;
            this.qualified_table_name();
            this.state = 831;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 175) {
                {
                this.state = 829;
                this.match(SqliteParser.WHERE_);
                this.state = 830;
                this.expr();
                }
            }

            this.state = 834;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 145) {
                {
                this.state = 833;
                this.returning_clause();
                }
            }

            this.state = 837;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 125) {
                {
                this.state = 836;
                this.order_clause();
                }
            }

            this.state = 840;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 111) {
                {
                this.state = 839;
                this.limit_clause();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public detach_stmt(): Detach_stmtContext {
        let localContext = new Detach_stmtContext(this.context, this.state);
        this.enterRule(localContext, 58, SqliteParser.RULE_detach_stmt);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 842;
            this.match(SqliteParser.DETACH_);
            this.state = 844;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 107, this.context) ) {
            case 1:
                {
                this.state = 843;
                this.match(SqliteParser.DATABASE_);
                }
                break;
            }
            this.state = 846;
            this.schema_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public drop_stmt(): Drop_stmtContext {
        let localContext = new Drop_stmtContext(this.context, this.state);
        this.enterRule(localContext, 60, SqliteParser.RULE_drop_stmt);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 848;
            this.match(SqliteParser.DROP_);
            this.state = 849;
            localContext._object = this.tokenStream.LT(1);
            _la = this.tokenStream.LA(1);
            if(!(_la === 96 || ((((_la - 156)) & ~0x1F) === 0 && ((1 << (_la - 156)) & 65665) !== 0))) {
                localContext._object = this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            this.state = 852;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 108, this.context) ) {
            case 1:
                {
                this.state = 850;
                this.match(SqliteParser.IF_);
                this.state = 851;
                this.match(SqliteParser.EXISTS_);
                }
                break;
            }
            this.state = 857;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 109, this.context) ) {
            case 1:
                {
                this.state = 854;
                this.schema_name();
                this.state = 855;
                this.match(SqliteParser.DOT);
                }
                break;
            }
            this.state = 859;
            this.any_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expr(): ExprContext {
        let localContext = new ExprContext(this.context, this.state);
        this.enterRule(localContext, 62, SqliteParser.RULE_expr);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 861;
            this.expr_or();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expr_or(): Expr_orContext {
        let localContext = new Expr_orContext(this.context, this.state);
        this.enterRule(localContext, 64, SqliteParser.RULE_expr_or);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 863;
            this.expr_and();
            this.state = 868;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 124) {
                {
                {
                this.state = 864;
                this.match(SqliteParser.OR_);
                this.state = 865;
                this.expr_and();
                }
                }
                this.state = 870;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expr_and(): Expr_andContext {
        let localContext = new Expr_andContext(this.context, this.state);
        this.enterRule(localContext, 66, SqliteParser.RULE_expr_and);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 871;
            this.expr_not();
            this.state = 876;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 35) {
                {
                {
                this.state = 872;
                this.match(SqliteParser.AND_);
                this.state = 873;
                this.expr_not();
                }
                }
                this.state = 878;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expr_not(): Expr_notContext {
        let localContext = new Expr_notContext(this.context, this.state);
        this.enterRule(localContext, 68, SqliteParser.RULE_expr_not);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 882;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 112, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 879;
                    this.match(SqliteParser.NOT_);
                    }
                    }
                }
                this.state = 884;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 112, this.context);
            }
            this.state = 885;
            this.expr_binary();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expr_binary(): Expr_binaryContext {
        let localContext = new Expr_binaryContext(this.context, this.state);
        this.enterRule(localContext, 70, SqliteParser.RULE_expr_binary);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 887;
            this.expr_comparison();
            this.state = 970;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 128, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    this.state = 968;
                    this.errorHandler.sync(this);
                    switch (this.interpreter.adaptivePredict(this.tokenStream, 127, this.context) ) {
                    case 1:
                        {
                        this.state = 888;
                        _la = this.tokenStream.LA(1);
                        if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 29360192) !== 0))) {
                        this.errorHandler.recoverInline(this);
                        }
                        else {
                            this.errorHandler.reportMatch(this);
                            this.consume();
                        }
                        this.state = 889;
                        this.expr_comparison();
                        }
                        break;
                    case 2:
                        {
                        this.state = 890;
                        this.match(SqliteParser.IS_);
                        this.state = 892;
                        this.errorHandler.sync(this);
                        switch (this.interpreter.adaptivePredict(this.tokenStream, 113, this.context) ) {
                        case 1:
                            {
                            this.state = 891;
                            this.match(SqliteParser.NOT_);
                            }
                            break;
                        }
                        this.state = 896;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if (_la === 66) {
                            {
                            this.state = 894;
                            this.match(SqliteParser.DISTINCT_);
                            this.state = 895;
                            this.match(SqliteParser.FROM_);
                            }
                        }

                        this.state = 898;
                        this.expr_comparison();
                        }
                        break;
                    case 3:
                        {
                        this.state = 900;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if (_la === 116) {
                            {
                            this.state = 899;
                            this.match(SqliteParser.NOT_);
                            }
                        }

                        this.state = 902;
                        this.match(SqliteParser.BETWEEN_);
                        this.state = 903;
                        this.expr_comparison();
                        this.state = 904;
                        this.match(SqliteParser.AND_);
                        this.state = 905;
                        this.expr_comparison();
                        }
                        break;
                    case 4:
                        {
                        this.state = 908;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if (_la === 116) {
                            {
                            this.state = 907;
                            this.match(SqliteParser.NOT_);
                            }
                        }

                        this.state = 910;
                        this.match(SqliteParser.IN_);
                        this.state = 949;
                        this.errorHandler.sync(this);
                        switch (this.interpreter.adaptivePredict(this.tokenStream, 123, this.context) ) {
                        case 1:
                            {
                            this.state = 911;
                            this.match(SqliteParser.OPEN_PAR);
                            this.state = 921;
                            this.errorHandler.sync(this);
                            switch (this.interpreter.adaptivePredict(this.tokenStream, 118, this.context) ) {
                            case 1:
                                {
                                this.state = 912;
                                this.select_stmt();
                                }
                                break;
                            case 2:
                                {
                                this.state = 913;
                                this.expr_comparison();
                                this.state = 918;
                                this.errorHandler.sync(this);
                                _la = this.tokenStream.LA(1);
                                while (_la === 5) {
                                    {
                                    {
                                    this.state = 914;
                                    this.match(SqliteParser.COMMA);
                                    this.state = 915;
                                    this.expr_comparison();
                                    }
                                    }
                                    this.state = 920;
                                    this.errorHandler.sync(this);
                                    _la = this.tokenStream.LA(1);
                                }
                                }
                                break;
                            }
                            this.state = 923;
                            this.match(SqliteParser.CLOSE_PAR);
                            }
                            break;
                        case 2:
                            {
                            this.state = 927;
                            this.errorHandler.sync(this);
                            switch (this.interpreter.adaptivePredict(this.tokenStream, 119, this.context) ) {
                            case 1:
                                {
                                this.state = 924;
                                this.schema_name();
                                this.state = 925;
                                this.match(SqliteParser.DOT);
                                }
                                break;
                            }
                            this.state = 929;
                            this.table_name();
                            }
                            break;
                        case 3:
                            {
                            this.state = 933;
                            this.errorHandler.sync(this);
                            switch (this.interpreter.adaptivePredict(this.tokenStream, 120, this.context) ) {
                            case 1:
                                {
                                this.state = 930;
                                this.schema_name();
                                this.state = 931;
                                this.match(SqliteParser.DOT);
                                }
                                break;
                            }
                            this.state = 935;
                            this.table_function_name();
                            this.state = 936;
                            this.match(SqliteParser.OPEN_PAR);
                            this.state = 945;
                            this.errorHandler.sync(this);
                            _la = this.tokenStream.LA(1);
                            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 1476396808) !== 0) || ((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 2816818611) !== 0) || ((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & 988249941) !== 0) || ((((_la - 97)) & ~0x1F) === 0 && ((1 << (_la - 97)) & 1674558519) !== 0) || ((((_la - 129)) & ~0x1F) === 0 && ((1 << (_la - 129)) & 3061775855) !== 0) || ((((_la - 163)) & ~0x1F) === 0 && ((1 << (_la - 163)) & 4179599) !== 0)) {
                                {
                                this.state = 937;
                                this.expr_comparison();
                                this.state = 942;
                                this.errorHandler.sync(this);
                                _la = this.tokenStream.LA(1);
                                while (_la === 5) {
                                    {
                                    {
                                    this.state = 938;
                                    this.match(SqliteParser.COMMA);
                                    this.state = 939;
                                    this.expr_comparison();
                                    }
                                    }
                                    this.state = 944;
                                    this.errorHandler.sync(this);
                                    _la = this.tokenStream.LA(1);
                                }
                                }
                            }

                            this.state = 947;
                            this.match(SqliteParser.CLOSE_PAR);
                            }
                            break;
                        }
                        }
                        break;
                    case 5:
                        {
                        this.state = 952;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if (_la === 116) {
                            {
                            this.state = 951;
                            this.match(SqliteParser.NOT_);
                            }
                        }

                        this.state = 962;
                        this.errorHandler.sync(this);
                        switch (this.tokenStream.LA(1)) {
                        case SqliteParser.LIKE_:
                            {
                            this.state = 954;
                            this.match(SqliteParser.LIKE_);
                            this.state = 955;
                            this.expr_comparison();
                            this.state = 958;
                            this.errorHandler.sync(this);
                            _la = this.tokenStream.LA(1);
                            if (_la === 72) {
                                {
                                this.state = 956;
                                this.match(SqliteParser.ESCAPE_);
                                this.state = 957;
                                this.expr_comparison();
                                }
                            }

                            }
                            break;
                        case SqliteParser.GLOB_:
                        case SqliteParser.MATCH_:
                        case SqliteParser.REGEXP_:
                            {
                            this.state = 960;
                            _la = this.tokenStream.LA(1);
                            if(!(_la === 88 || _la === 112 || _la === 139)) {
                            this.errorHandler.recoverInline(this);
                            }
                            else {
                                this.errorHandler.reportMatch(this);
                                this.consume();
                            }
                            this.state = 961;
                            this.expr_comparison();
                            }
                            break;
                        default:
                            throw new antlr.NoViableAltException(this);
                        }
                        }
                        break;
                    case 6:
                        {
                        this.state = 964;
                        this.match(SqliteParser.ISNULL_);
                        }
                        break;
                    case 7:
                        {
                        this.state = 965;
                        this.match(SqliteParser.NOTNULL_);
                        }
                        break;
                    case 8:
                        {
                        this.state = 966;
                        this.match(SqliteParser.NOT_);
                        this.state = 967;
                        this.match(SqliteParser.NULL_);
                        }
                        break;
                    }
                    }
                }
                this.state = 972;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 128, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expr_comparison(): Expr_comparisonContext {
        let localContext = new Expr_comparisonContext(this.context, this.state);
        this.enterRule(localContext, 72, SqliteParser.RULE_expr_comparison);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 973;
            this.expr_bitwise();
            this.state = 978;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3932160) !== 0)) {
                {
                {
                this.state = 974;
                _la = this.tokenStream.LA(1);
                if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 3932160) !== 0))) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 975;
                this.expr_bitwise();
                }
                }
                this.state = 980;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expr_bitwise(): Expr_bitwiseContext {
        let localContext = new Expr_bitwiseContext(this.context, this.state);
        this.enterRule(localContext, 74, SqliteParser.RULE_expr_bitwise);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 981;
            this.expr_addition();
            this.state = 986;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 245760) !== 0)) {
                {
                {
                this.state = 982;
                _la = this.tokenStream.LA(1);
                if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 245760) !== 0))) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 983;
                this.expr_addition();
                }
                }
                this.state = 988;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expr_addition(): Expr_additionContext {
        let localContext = new Expr_additionContext(this.context, this.state);
        this.enterRule(localContext, 76, SqliteParser.RULE_expr_addition);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 989;
            this.expr_multiplication();
            this.state = 994;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 8 || _la === 9) {
                {
                {
                this.state = 990;
                _la = this.tokenStream.LA(1);
                if(!(_la === 8 || _la === 9)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 991;
                this.expr_multiplication();
                }
                }
                this.state = 996;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expr_multiplication(): Expr_multiplicationContext {
        let localContext = new Expr_multiplicationContext(this.context, this.state);
        this.enterRule(localContext, 78, SqliteParser.RULE_expr_multiplication);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 997;
            this.expr_string();
            this.state = 1002;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 12416) !== 0)) {
                {
                {
                this.state = 998;
                _la = this.tokenStream.LA(1);
                if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 12416) !== 0))) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 999;
                this.expr_string();
                }
                }
                this.state = 1004;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expr_string(): Expr_stringContext {
        let localContext = new Expr_stringContext(this.context, this.state);
        this.enterRule(localContext, 80, SqliteParser.RULE_expr_string);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1005;
            this.expr_collate();
            this.state = 1010;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 100665344) !== 0)) {
                {
                {
                this.state = 1006;
                _la = this.tokenStream.LA(1);
                if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 100665344) !== 0))) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 1007;
                this.expr_collate();
                }
                }
                this.state = 1012;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expr_collate(): Expr_collateContext {
        let localContext = new Expr_collateContext(this.context, this.state);
        this.enterRule(localContext, 82, SqliteParser.RULE_expr_collate);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1013;
            this.expr_unary();
            this.state = 1018;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 134, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 1014;
                    this.match(SqliteParser.COLLATE_);
                    this.state = 1015;
                    this.collation_name();
                    }
                    }
                }
                this.state = 1020;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 134, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expr_unary(): Expr_unaryContext {
        let localContext = new Expr_unaryContext(this.context, this.state);
        this.enterRule(localContext, 84, SqliteParser.RULE_expr_unary);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1024;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 1792) !== 0)) {
                {
                {
                this.state = 1021;
                _la = this.tokenStream.LA(1);
                if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 1792) !== 0))) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                }
                }
                this.state = 1026;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 1027;
            this.expr_base();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expr_base(): Expr_baseContext {
        let localContext = new Expr_baseContext(this.context, this.state);
        this.enterRule(localContext, 86, SqliteParser.RULE_expr_base);
        let _la: number;
        try {
            this.state = 1053;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 139, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1029;
                this.literal_value();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1030;
                this.match(SqliteParser.BIND_PARAMETER);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1034;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 136, this.context) ) {
                case 1:
                    {
                    this.state = 1031;
                    this.schema_name();
                    this.state = 1032;
                    this.match(SqliteParser.DOT);
                    }
                    break;
                }
                this.state = 1036;
                this.table_name();
                this.state = 1037;
                this.match(SqliteParser.DOT);
                this.state = 1038;
                this.column_name();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 1040;
                this.column_name_excluding_string();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 1045;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 76 || _la === 116) {
                    {
                    this.state = 1042;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 116) {
                        {
                        this.state = 1041;
                        this.match(SqliteParser.NOT_);
                        }
                    }

                    this.state = 1044;
                    this.match(SqliteParser.EXISTS_);
                    }
                }

                this.state = 1047;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 1048;
                this.select_stmt();
                this.state = 1049;
                this.match(SqliteParser.CLOSE_PAR);
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 1051;
                this.raise_function();
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 1052;
                this.expr_recursive();
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expr_recursive(): Expr_recursiveContext {
        let localContext = new Expr_recursiveContext(this.context, this.state);
        this.enterRule(localContext, 88, SqliteParser.RULE_expr_recursive);
        let _la: number;
        try {
            this.state = 1121;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 151, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1055;
                this.function_name();
                this.state = 1056;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 1072;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case SqliteParser.OPEN_PAR:
                case SqliteParser.PLUS:
                case SqliteParser.MINUS:
                case SqliteParser.TILDE:
                case SqliteParser.ABORT_:
                case SqliteParser.ACTION_:
                case SqliteParser.AFTER_:
                case SqliteParser.ALWAYS_:
                case SqliteParser.ANALYZE_:
                case SqliteParser.ASC_:
                case SqliteParser.ATTACH_:
                case SqliteParser.BEFORE_:
                case SqliteParser.BEGIN_:
                case SqliteParser.BY_:
                case SqliteParser.CASCADE_:
                case SqliteParser.CASE_:
                case SqliteParser.CAST_:
                case SqliteParser.COLUMN_:
                case SqliteParser.CONFLICT_:
                case SqliteParser.CROSS_:
                case SqliteParser.CURRENT_:
                case SqliteParser.CURRENT_DATE_:
                case SqliteParser.CURRENT_TIME_:
                case SqliteParser.CURRENT_TIMESTAMP_:
                case SqliteParser.DATABASE_:
                case SqliteParser.DEFERRED_:
                case SqliteParser.DESC_:
                case SqliteParser.DETACH_:
                case SqliteParser.DISTINCT_:
                case SqliteParser.DO_:
                case SqliteParser.EACH_:
                case SqliteParser.END_:
                case SqliteParser.EXCEPT_:
                case SqliteParser.EXCLUDE_:
                case SqliteParser.EXCLUSIVE_:
                case SqliteParser.EXISTS_:
                case SqliteParser.EXPLAIN_:
                case SqliteParser.FAIL_:
                case SqliteParser.FALSE_:
                case SqliteParser.FIRST_:
                case SqliteParser.FOLLOWING_:
                case SqliteParser.FOR_:
                case SqliteParser.FULL_:
                case SqliteParser.GENERATED_:
                case SqliteParser.GLOB_:
                case SqliteParser.GROUPS_:
                case SqliteParser.IF_:
                case SqliteParser.IGNORE_:
                case SqliteParser.IMMEDIATE_:
                case SqliteParser.INDEXED_:
                case SqliteParser.INITIALLY_:
                case SqliteParser.INNER_:
                case SqliteParser.INSTEAD_:
                case SqliteParser.INTERSECT_:
                case SqliteParser.KEY_:
                case SqliteParser.LAST_:
                case SqliteParser.LEFT_:
                case SqliteParser.LIKE_:
                case SqliteParser.MATCH_:
                case SqliteParser.MATERIALIZED_:
                case SqliteParser.NATURAL_:
                case SqliteParser.NO_:
                case SqliteParser.NOT_:
                case SqliteParser.NULL_:
                case SqliteParser.NULLS_:
                case SqliteParser.OF_:
                case SqliteParser.OFFSET_:
                case SqliteParser.OTHERS_:
                case SqliteParser.OUTER_:
                case SqliteParser.PARTITION_:
                case SqliteParser.PLAN_:
                case SqliteParser.PRAGMA_:
                case SqliteParser.PRECEDING_:
                case SqliteParser.QUERY_:
                case SqliteParser.RAISE_:
                case SqliteParser.RANGE_:
                case SqliteParser.RECURSIVE_:
                case SqliteParser.REGEXP_:
                case SqliteParser.REINDEX_:
                case SqliteParser.RELEASE_:
                case SqliteParser.RENAME_:
                case SqliteParser.REPLACE_:
                case SqliteParser.RESTRICT_:
                case SqliteParser.RIGHT_:
                case SqliteParser.ROLLBACK_:
                case SqliteParser.ROW_:
                case SqliteParser.ROWID_:
                case SqliteParser.ROWS_:
                case SqliteParser.SAVEPOINT_:
                case SqliteParser.STORED_:
                case SqliteParser.STRICT_:
                case SqliteParser.TEMP_:
                case SqliteParser.TEMPORARY_:
                case SqliteParser.TIES_:
                case SqliteParser.TRIGGER_:
                case SqliteParser.TRUE_:
                case SqliteParser.UNBOUNDED_:
                case SqliteParser.UNION_:
                case SqliteParser.VACUUM_:
                case SqliteParser.VIEW_:
                case SqliteParser.VIRTUAL_:
                case SqliteParser.WITH_:
                case SqliteParser.WITHIN_:
                case SqliteParser.WITHOUT_:
                case SqliteParser.IDENTIFIER:
                case SqliteParser.NUMERIC_LITERAL:
                case SqliteParser.BIND_PARAMETER:
                case SqliteParser.STRING_LITERAL:
                case SqliteParser.BLOB_LITERAL:
                    {
                    this.state = 1058;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 66) {
                        {
                        this.state = 1057;
                        this.match(SqliteParser.DISTINCT_);
                        }
                    }

                    this.state = 1060;
                    this.expr();
                    this.state = 1065;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    while (_la === 5) {
                        {
                        {
                        this.state = 1061;
                        this.match(SqliteParser.COMMA);
                        this.state = 1062;
                        this.expr();
                        }
                        }
                        this.state = 1067;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                    }
                    this.state = 1069;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 125) {
                        {
                        this.state = 1068;
                        this.order_clause();
                        }
                    }

                    }
                    break;
                case SqliteParser.STAR:
                    {
                    this.state = 1071;
                    this.match(SqliteParser.STAR);
                    }
                    break;
                case SqliteParser.CLOSE_PAR:
                    break;
                default:
                    break;
                }
                this.state = 1074;
                this.match(SqliteParser.CLOSE_PAR);
                this.state = 1076;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 144, this.context) ) {
                case 1:
                    {
                    this.state = 1075;
                    this.percentile_clause();
                    }
                    break;
                }
                this.state = 1079;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 80) {
                    {
                    this.state = 1078;
                    this.filter_clause();
                    }
                }

                this.state = 1082;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 128) {
                    {
                    this.state = 1081;
                    this.over_clause();
                    }
                }

                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1084;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 1085;
                this.expr();
                this.state = 1090;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 5) {
                    {
                    {
                    this.state = 1086;
                    this.match(SqliteParser.COMMA);
                    this.state = 1087;
                    this.expr();
                    }
                    }
                    this.state = 1092;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 1093;
                this.match(SqliteParser.CLOSE_PAR);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1095;
                this.match(SqliteParser.CAST_);
                this.state = 1096;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 1097;
                this.expr();
                this.state = 1098;
                this.match(SqliteParser.AS_);
                this.state = 1099;
                this.type_name();
                this.state = 1100;
                this.match(SqliteParser.CLOSE_PAR);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 1102;
                this.match(SqliteParser.CASE_);
                this.state = 1104;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 1476396808) !== 0) || ((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 2816818611) !== 0) || ((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & 988249941) !== 0) || ((((_la - 97)) & ~0x1F) === 0 && ((1 << (_la - 97)) & 1674558519) !== 0) || ((((_la - 129)) & ~0x1F) === 0 && ((1 << (_la - 129)) & 3061775855) !== 0) || ((((_la - 163)) & ~0x1F) === 0 && ((1 << (_la - 163)) & 4179599) !== 0)) {
                    {
                    this.state = 1103;
                    this.expr();
                    }
                }

                this.state = 1111;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 1106;
                    this.match(SqliteParser.WHEN_);
                    this.state = 1107;
                    this.expr();
                    this.state = 1108;
                    this.match(SqliteParser.THEN_);
                    this.state = 1109;
                    this.expr();
                    }
                    }
                    this.state = 1113;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                } while (_la === 174);
                this.state = 1117;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 70) {
                    {
                    this.state = 1115;
                    this.match(SqliteParser.ELSE_);
                    this.state = 1116;
                    this.expr();
                    }
                }

                this.state = 1119;
                this.match(SqliteParser.END_);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public raise_function(): Raise_functionContext {
        let localContext = new Raise_functionContext(this.context, this.state);
        this.enterRule(localContext, 90, SqliteParser.RULE_raise_function);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1123;
            this.match(SqliteParser.RAISE_);
            this.state = 1124;
            this.match(SqliteParser.OPEN_PAR);
            this.state = 1129;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.IGNORE_:
                {
                this.state = 1125;
                this.match(SqliteParser.IGNORE_);
                }
                break;
            case SqliteParser.ABORT_:
            case SqliteParser.FAIL_:
            case SqliteParser.ROLLBACK_:
                {
                this.state = 1126;
                _la = this.tokenStream.LA(1);
                if(!(_la === 27 || _la === 78 || _la === 147)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 1127;
                this.match(SqliteParser.COMMA);
                this.state = 1128;
                this.error_message();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            this.state = 1131;
            this.match(SqliteParser.CLOSE_PAR);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public literal_value(): Literal_valueContext {
        let localContext = new Literal_valueContext(this.context, this.state);
        this.enterRule(localContext, 92, SqliteParser.RULE_literal_value);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1133;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 56)) & ~0x1F) === 0 && ((1 << (_la - 56)) & 8388615) !== 0) || _la === 119 || ((((_la - 164)) & ~0x1F) === 0 && ((1 << (_la - 164)) & 1703937) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public percentile_clause(): Percentile_clauseContext {
        let localContext = new Percentile_clauseContext(this.context, this.state);
        this.enterRule(localContext, 94, SqliteParser.RULE_percentile_clause);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1135;
            this.match(SqliteParser.WITHIN_);
            this.state = 1136;
            this.match(SqliteParser.GROUP_);
            this.state = 1137;
            this.match(SqliteParser.OPEN_PAR);
            this.state = 1138;
            this.match(SqliteParser.ORDER_);
            this.state = 1139;
            this.match(SqliteParser.BY_);
            this.state = 1140;
            this.expr();
            this.state = 1141;
            this.match(SqliteParser.CLOSE_PAR);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public value_row(): Value_rowContext {
        let localContext = new Value_rowContext(this.context, this.state);
        this.enterRule(localContext, 96, SqliteParser.RULE_value_row);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1143;
            this.match(SqliteParser.OPEN_PAR);
            this.state = 1144;
            this.expr();
            this.state = 1149;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 5) {
                {
                {
                this.state = 1145;
                this.match(SqliteParser.COMMA);
                this.state = 1146;
                this.expr();
                }
                }
                this.state = 1151;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 1152;
            this.match(SqliteParser.CLOSE_PAR);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public values_clause(): Values_clauseContext {
        let localContext = new Values_clauseContext(this.context, this.state);
        this.enterRule(localContext, 98, SqliteParser.RULE_values_clause);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1154;
            this.match(SqliteParser.VALUES_);
            this.state = 1155;
            this.value_row();
            this.state = 1160;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 5) {
                {
                {
                this.state = 1156;
                this.match(SqliteParser.COMMA);
                this.state = 1157;
                this.value_row();
                }
                }
                this.state = 1162;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public insert_stmt(): Insert_stmtContext {
        let localContext = new Insert_stmtContext(this.context, this.state);
        this.enterRule(localContext, 100, SqliteParser.RULE_insert_stmt);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1164;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 177) {
                {
                this.state = 1163;
                this.with_clause();
                }
            }

            this.state = 1171;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 156, this.context) ) {
            case 1:
                {
                this.state = 1166;
                this.match(SqliteParser.INSERT_);
                }
                break;
            case 2:
                {
                this.state = 1167;
                this.match(SqliteParser.REPLACE_);
                }
                break;
            case 3:
                {
                this.state = 1168;
                this.match(SqliteParser.INSERT_);
                this.state = 1169;
                this.match(SqliteParser.OR_);
                this.state = 1170;
                _la = this.tokenStream.LA(1);
                if(!(_la === 27 || _la === 78 || _la === 93 || _la === 143 || _la === 147)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                }
                break;
            }
            this.state = 1173;
            this.match(SqliteParser.INTO_);
            this.state = 1177;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 157, this.context) ) {
            case 1:
                {
                this.state = 1174;
                this.schema_name();
                this.state = 1175;
                this.match(SqliteParser.DOT);
                }
                break;
            }
            this.state = 1179;
            this.table_name();
            this.state = 1182;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 36) {
                {
                this.state = 1180;
                this.match(SqliteParser.AS_);
                this.state = 1181;
                this.table_alias();
                }
            }

            this.state = 1195;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 3) {
                {
                this.state = 1184;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 1185;
                this.column_name();
                this.state = 1190;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 5) {
                    {
                    {
                    this.state = 1186;
                    this.match(SqliteParser.COMMA);
                    this.state = 1187;
                    this.column_name();
                    }
                    }
                    this.state = 1192;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 1193;
                this.match(SqliteParser.CLOSE_PAR);
                }
            }

            this.state = 1206;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.SELECT_:
            case SqliteParser.VALUES_:
            case SqliteParser.WITH_:
                {
                this.state = 1197;
                this.select_stmt();
                this.state = 1201;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 123) {
                    {
                    {
                    this.state = 1198;
                    this.upsert_clause();
                    }
                    }
                    this.state = 1203;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                }
                break;
            case SqliteParser.DEFAULT_:
                {
                this.state = 1204;
                this.match(SqliteParser.DEFAULT_);
                this.state = 1205;
                this.match(SqliteParser.VALUES_);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            this.state = 1209;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 145) {
                {
                this.state = 1208;
                this.returning_clause();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public returning_clause(): Returning_clauseContext {
        let localContext = new Returning_clauseContext(this.context, this.state);
        this.enterRule(localContext, 102, SqliteParser.RULE_returning_clause);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1211;
            this.match(SqliteParser.RETURNING_);
            this.state = 1220;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.STAR:
                {
                this.state = 1212;
                this.match(SqliteParser.STAR);
                }
                break;
            case SqliteParser.OPEN_PAR:
            case SqliteParser.PLUS:
            case SqliteParser.MINUS:
            case SqliteParser.TILDE:
            case SqliteParser.ABORT_:
            case SqliteParser.ACTION_:
            case SqliteParser.AFTER_:
            case SqliteParser.ALWAYS_:
            case SqliteParser.ANALYZE_:
            case SqliteParser.ASC_:
            case SqliteParser.ATTACH_:
            case SqliteParser.BEFORE_:
            case SqliteParser.BEGIN_:
            case SqliteParser.BY_:
            case SqliteParser.CASCADE_:
            case SqliteParser.CASE_:
            case SqliteParser.CAST_:
            case SqliteParser.COLUMN_:
            case SqliteParser.CONFLICT_:
            case SqliteParser.CROSS_:
            case SqliteParser.CURRENT_:
            case SqliteParser.CURRENT_DATE_:
            case SqliteParser.CURRENT_TIME_:
            case SqliteParser.CURRENT_TIMESTAMP_:
            case SqliteParser.DATABASE_:
            case SqliteParser.DEFERRED_:
            case SqliteParser.DESC_:
            case SqliteParser.DETACH_:
            case SqliteParser.DO_:
            case SqliteParser.EACH_:
            case SqliteParser.END_:
            case SqliteParser.EXCEPT_:
            case SqliteParser.EXCLUDE_:
            case SqliteParser.EXCLUSIVE_:
            case SqliteParser.EXISTS_:
            case SqliteParser.EXPLAIN_:
            case SqliteParser.FAIL_:
            case SqliteParser.FALSE_:
            case SqliteParser.FIRST_:
            case SqliteParser.FOLLOWING_:
            case SqliteParser.FOR_:
            case SqliteParser.FULL_:
            case SqliteParser.GENERATED_:
            case SqliteParser.GLOB_:
            case SqliteParser.GROUPS_:
            case SqliteParser.IF_:
            case SqliteParser.IGNORE_:
            case SqliteParser.IMMEDIATE_:
            case SqliteParser.INDEXED_:
            case SqliteParser.INITIALLY_:
            case SqliteParser.INNER_:
            case SqliteParser.INSTEAD_:
            case SqliteParser.INTERSECT_:
            case SqliteParser.KEY_:
            case SqliteParser.LAST_:
            case SqliteParser.LEFT_:
            case SqliteParser.LIKE_:
            case SqliteParser.MATCH_:
            case SqliteParser.MATERIALIZED_:
            case SqliteParser.NATURAL_:
            case SqliteParser.NO_:
            case SqliteParser.NOT_:
            case SqliteParser.NULL_:
            case SqliteParser.NULLS_:
            case SqliteParser.OF_:
            case SqliteParser.OFFSET_:
            case SqliteParser.OTHERS_:
            case SqliteParser.OUTER_:
            case SqliteParser.PARTITION_:
            case SqliteParser.PLAN_:
            case SqliteParser.PRAGMA_:
            case SqliteParser.PRECEDING_:
            case SqliteParser.QUERY_:
            case SqliteParser.RAISE_:
            case SqliteParser.RANGE_:
            case SqliteParser.RECURSIVE_:
            case SqliteParser.REGEXP_:
            case SqliteParser.REINDEX_:
            case SqliteParser.RELEASE_:
            case SqliteParser.RENAME_:
            case SqliteParser.REPLACE_:
            case SqliteParser.RESTRICT_:
            case SqliteParser.RIGHT_:
            case SqliteParser.ROLLBACK_:
            case SqliteParser.ROW_:
            case SqliteParser.ROWID_:
            case SqliteParser.ROWS_:
            case SqliteParser.SAVEPOINT_:
            case SqliteParser.STORED_:
            case SqliteParser.STRICT_:
            case SqliteParser.TEMP_:
            case SqliteParser.TEMPORARY_:
            case SqliteParser.TIES_:
            case SqliteParser.TRIGGER_:
            case SqliteParser.TRUE_:
            case SqliteParser.UNBOUNDED_:
            case SqliteParser.UNION_:
            case SqliteParser.VACUUM_:
            case SqliteParser.VIEW_:
            case SqliteParser.VIRTUAL_:
            case SqliteParser.WITH_:
            case SqliteParser.WITHIN_:
            case SqliteParser.WITHOUT_:
            case SqliteParser.IDENTIFIER:
            case SqliteParser.NUMERIC_LITERAL:
            case SqliteParser.BIND_PARAMETER:
            case SqliteParser.STRING_LITERAL:
            case SqliteParser.BLOB_LITERAL:
                {
                this.state = 1213;
                this.expr();
                this.state = 1218;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 27)) & ~0x1F) === 0 && ((1 << (_la - 27)) & 4182470347) !== 0) || ((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 3118323049) !== 0) || ((((_la - 92)) & ~0x1F) === 0 && ((1 << (_la - 92)) & 1895270119) !== 0) || ((((_la - 126)) & ~0x1F) === 0 && ((1 << (_la - 126)) & 3019370363) !== 0) || ((((_la - 158)) & ~0x1F) === 0 && ((1 << (_la - 158)) & 41472485) !== 0)) {
                    {
                    this.state = 1215;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 36) {
                        {
                        this.state = 1214;
                        this.match(SqliteParser.AS_);
                        }
                    }

                    this.state = 1217;
                    this.column_alias();
                    }
                }

                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            this.state = 1235;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 5) {
                {
                {
                this.state = 1222;
                this.match(SqliteParser.COMMA);
                this.state = 1231;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case SqliteParser.STAR:
                    {
                    this.state = 1223;
                    this.match(SqliteParser.STAR);
                    }
                    break;
                case SqliteParser.OPEN_PAR:
                case SqliteParser.PLUS:
                case SqliteParser.MINUS:
                case SqliteParser.TILDE:
                case SqliteParser.ABORT_:
                case SqliteParser.ACTION_:
                case SqliteParser.AFTER_:
                case SqliteParser.ALWAYS_:
                case SqliteParser.ANALYZE_:
                case SqliteParser.ASC_:
                case SqliteParser.ATTACH_:
                case SqliteParser.BEFORE_:
                case SqliteParser.BEGIN_:
                case SqliteParser.BY_:
                case SqliteParser.CASCADE_:
                case SqliteParser.CASE_:
                case SqliteParser.CAST_:
                case SqliteParser.COLUMN_:
                case SqliteParser.CONFLICT_:
                case SqliteParser.CROSS_:
                case SqliteParser.CURRENT_:
                case SqliteParser.CURRENT_DATE_:
                case SqliteParser.CURRENT_TIME_:
                case SqliteParser.CURRENT_TIMESTAMP_:
                case SqliteParser.DATABASE_:
                case SqliteParser.DEFERRED_:
                case SqliteParser.DESC_:
                case SqliteParser.DETACH_:
                case SqliteParser.DO_:
                case SqliteParser.EACH_:
                case SqliteParser.END_:
                case SqliteParser.EXCEPT_:
                case SqliteParser.EXCLUDE_:
                case SqliteParser.EXCLUSIVE_:
                case SqliteParser.EXISTS_:
                case SqliteParser.EXPLAIN_:
                case SqliteParser.FAIL_:
                case SqliteParser.FALSE_:
                case SqliteParser.FIRST_:
                case SqliteParser.FOLLOWING_:
                case SqliteParser.FOR_:
                case SqliteParser.FULL_:
                case SqliteParser.GENERATED_:
                case SqliteParser.GLOB_:
                case SqliteParser.GROUPS_:
                case SqliteParser.IF_:
                case SqliteParser.IGNORE_:
                case SqliteParser.IMMEDIATE_:
                case SqliteParser.INDEXED_:
                case SqliteParser.INITIALLY_:
                case SqliteParser.INNER_:
                case SqliteParser.INSTEAD_:
                case SqliteParser.INTERSECT_:
                case SqliteParser.KEY_:
                case SqliteParser.LAST_:
                case SqliteParser.LEFT_:
                case SqliteParser.LIKE_:
                case SqliteParser.MATCH_:
                case SqliteParser.MATERIALIZED_:
                case SqliteParser.NATURAL_:
                case SqliteParser.NO_:
                case SqliteParser.NOT_:
                case SqliteParser.NULL_:
                case SqliteParser.NULLS_:
                case SqliteParser.OF_:
                case SqliteParser.OFFSET_:
                case SqliteParser.OTHERS_:
                case SqliteParser.OUTER_:
                case SqliteParser.PARTITION_:
                case SqliteParser.PLAN_:
                case SqliteParser.PRAGMA_:
                case SqliteParser.PRECEDING_:
                case SqliteParser.QUERY_:
                case SqliteParser.RAISE_:
                case SqliteParser.RANGE_:
                case SqliteParser.RECURSIVE_:
                case SqliteParser.REGEXP_:
                case SqliteParser.REINDEX_:
                case SqliteParser.RELEASE_:
                case SqliteParser.RENAME_:
                case SqliteParser.REPLACE_:
                case SqliteParser.RESTRICT_:
                case SqliteParser.RIGHT_:
                case SqliteParser.ROLLBACK_:
                case SqliteParser.ROW_:
                case SqliteParser.ROWID_:
                case SqliteParser.ROWS_:
                case SqliteParser.SAVEPOINT_:
                case SqliteParser.STORED_:
                case SqliteParser.STRICT_:
                case SqliteParser.TEMP_:
                case SqliteParser.TEMPORARY_:
                case SqliteParser.TIES_:
                case SqliteParser.TRIGGER_:
                case SqliteParser.TRUE_:
                case SqliteParser.UNBOUNDED_:
                case SqliteParser.UNION_:
                case SqliteParser.VACUUM_:
                case SqliteParser.VIEW_:
                case SqliteParser.VIRTUAL_:
                case SqliteParser.WITH_:
                case SqliteParser.WITHIN_:
                case SqliteParser.WITHOUT_:
                case SqliteParser.IDENTIFIER:
                case SqliteParser.NUMERIC_LITERAL:
                case SqliteParser.BIND_PARAMETER:
                case SqliteParser.STRING_LITERAL:
                case SqliteParser.BLOB_LITERAL:
                    {
                    this.state = 1224;
                    this.expr();
                    this.state = 1229;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (((((_la - 27)) & ~0x1F) === 0 && ((1 << (_la - 27)) & 4182470347) !== 0) || ((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 3118323049) !== 0) || ((((_la - 92)) & ~0x1F) === 0 && ((1 << (_la - 92)) & 1895270119) !== 0) || ((((_la - 126)) & ~0x1F) === 0 && ((1 << (_la - 126)) & 3019370363) !== 0) || ((((_la - 158)) & ~0x1F) === 0 && ((1 << (_la - 158)) & 41472485) !== 0)) {
                        {
                        this.state = 1226;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if (_la === 36) {
                            {
                            this.state = 1225;
                            this.match(SqliteParser.AS_);
                            }
                        }

                        this.state = 1228;
                        this.column_alias();
                        }
                    }

                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                }
                }
                this.state = 1237;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public upsert_clause(): Upsert_clauseContext {
        let localContext = new Upsert_clauseContext(this.context, this.state);
        this.enterRule(localContext, 104, SqliteParser.RULE_upsert_clause);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1238;
            this.match(SqliteParser.ON_);
            this.state = 1239;
            this.match(SqliteParser.CONFLICT_);
            this.state = 1254;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 3) {
                {
                this.state = 1240;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 1241;
                this.indexed_column();
                this.state = 1246;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 5) {
                    {
                    {
                    this.state = 1242;
                    this.match(SqliteParser.COMMA);
                    this.state = 1243;
                    this.indexed_column();
                    }
                    }
                    this.state = 1248;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 1249;
                this.match(SqliteParser.CLOSE_PAR);
                this.state = 1252;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 175) {
                    {
                    this.state = 1250;
                    this.match(SqliteParser.WHERE_);
                    this.state = 1251;
                    this.expr();
                    }
                }

                }
            }

            this.state = 1256;
            this.match(SqliteParser.DO_);
            this.state = 1283;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.NOTHING_:
                {
                this.state = 1257;
                this.match(SqliteParser.NOTHING_);
                }
                break;
            case SqliteParser.UPDATE_:
                {
                this.state = 1258;
                this.match(SqliteParser.UPDATE_);
                this.state = 1259;
                this.match(SqliteParser.SET_);
                this.state = 1262;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case SqliteParser.ABORT_:
                case SqliteParser.ACTION_:
                case SqliteParser.AFTER_:
                case SqliteParser.ALWAYS_:
                case SqliteParser.ANALYZE_:
                case SqliteParser.ASC_:
                case SqliteParser.ATTACH_:
                case SqliteParser.BEFORE_:
                case SqliteParser.BEGIN_:
                case SqliteParser.BY_:
                case SqliteParser.CASCADE_:
                case SqliteParser.CAST_:
                case SqliteParser.COLUMN_:
                case SqliteParser.CONFLICT_:
                case SqliteParser.CROSS_:
                case SqliteParser.CURRENT_:
                case SqliteParser.CURRENT_DATE_:
                case SqliteParser.CURRENT_TIME_:
                case SqliteParser.CURRENT_TIMESTAMP_:
                case SqliteParser.DATABASE_:
                case SqliteParser.DEFERRED_:
                case SqliteParser.DESC_:
                case SqliteParser.DETACH_:
                case SqliteParser.DO_:
                case SqliteParser.EACH_:
                case SqliteParser.END_:
                case SqliteParser.EXCEPT_:
                case SqliteParser.EXCLUDE_:
                case SqliteParser.EXCLUSIVE_:
                case SqliteParser.EXPLAIN_:
                case SqliteParser.FAIL_:
                case SqliteParser.FALSE_:
                case SqliteParser.FIRST_:
                case SqliteParser.FOLLOWING_:
                case SqliteParser.FOR_:
                case SqliteParser.FULL_:
                case SqliteParser.GENERATED_:
                case SqliteParser.GLOB_:
                case SqliteParser.GROUPS_:
                case SqliteParser.IF_:
                case SqliteParser.IGNORE_:
                case SqliteParser.IMMEDIATE_:
                case SqliteParser.INDEXED_:
                case SqliteParser.INITIALLY_:
                case SqliteParser.INNER_:
                case SqliteParser.INSTEAD_:
                case SqliteParser.INTERSECT_:
                case SqliteParser.KEY_:
                case SqliteParser.LAST_:
                case SqliteParser.LEFT_:
                case SqliteParser.LIKE_:
                case SqliteParser.MATCH_:
                case SqliteParser.MATERIALIZED_:
                case SqliteParser.NATURAL_:
                case SqliteParser.NO_:
                case SqliteParser.NULLS_:
                case SqliteParser.OF_:
                case SqliteParser.OFFSET_:
                case SqliteParser.OTHERS_:
                case SqliteParser.OUTER_:
                case SqliteParser.PARTITION_:
                case SqliteParser.PLAN_:
                case SqliteParser.PRAGMA_:
                case SqliteParser.PRECEDING_:
                case SqliteParser.QUERY_:
                case SqliteParser.RAISE_:
                case SqliteParser.RANGE_:
                case SqliteParser.RECURSIVE_:
                case SqliteParser.REGEXP_:
                case SqliteParser.REINDEX_:
                case SqliteParser.RELEASE_:
                case SqliteParser.RENAME_:
                case SqliteParser.REPLACE_:
                case SqliteParser.RESTRICT_:
                case SqliteParser.RIGHT_:
                case SqliteParser.ROLLBACK_:
                case SqliteParser.ROW_:
                case SqliteParser.ROWID_:
                case SqliteParser.ROWS_:
                case SqliteParser.SAVEPOINT_:
                case SqliteParser.STORED_:
                case SqliteParser.STRICT_:
                case SqliteParser.TEMP_:
                case SqliteParser.TEMPORARY_:
                case SqliteParser.TIES_:
                case SqliteParser.TRIGGER_:
                case SqliteParser.TRUE_:
                case SqliteParser.UNBOUNDED_:
                case SqliteParser.UNION_:
                case SqliteParser.VACUUM_:
                case SqliteParser.VIEW_:
                case SqliteParser.VIRTUAL_:
                case SqliteParser.WITH_:
                case SqliteParser.WITHIN_:
                case SqliteParser.WITHOUT_:
                case SqliteParser.IDENTIFIER:
                case SqliteParser.STRING_LITERAL:
                    {
                    this.state = 1260;
                    this.column_name();
                    }
                    break;
                case SqliteParser.OPEN_PAR:
                    {
                    this.state = 1261;
                    this.column_name_list();
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                this.state = 1264;
                this.match(SqliteParser.ASSIGN);
                this.state = 1265;
                this.expr();
                this.state = 1276;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 5) {
                    {
                    {
                    this.state = 1266;
                    this.match(SqliteParser.COMMA);
                    this.state = 1269;
                    this.errorHandler.sync(this);
                    switch (this.tokenStream.LA(1)) {
                    case SqliteParser.ABORT_:
                    case SqliteParser.ACTION_:
                    case SqliteParser.AFTER_:
                    case SqliteParser.ALWAYS_:
                    case SqliteParser.ANALYZE_:
                    case SqliteParser.ASC_:
                    case SqliteParser.ATTACH_:
                    case SqliteParser.BEFORE_:
                    case SqliteParser.BEGIN_:
                    case SqliteParser.BY_:
                    case SqliteParser.CASCADE_:
                    case SqliteParser.CAST_:
                    case SqliteParser.COLUMN_:
                    case SqliteParser.CONFLICT_:
                    case SqliteParser.CROSS_:
                    case SqliteParser.CURRENT_:
                    case SqliteParser.CURRENT_DATE_:
                    case SqliteParser.CURRENT_TIME_:
                    case SqliteParser.CURRENT_TIMESTAMP_:
                    case SqliteParser.DATABASE_:
                    case SqliteParser.DEFERRED_:
                    case SqliteParser.DESC_:
                    case SqliteParser.DETACH_:
                    case SqliteParser.DO_:
                    case SqliteParser.EACH_:
                    case SqliteParser.END_:
                    case SqliteParser.EXCEPT_:
                    case SqliteParser.EXCLUDE_:
                    case SqliteParser.EXCLUSIVE_:
                    case SqliteParser.EXPLAIN_:
                    case SqliteParser.FAIL_:
                    case SqliteParser.FALSE_:
                    case SqliteParser.FIRST_:
                    case SqliteParser.FOLLOWING_:
                    case SqliteParser.FOR_:
                    case SqliteParser.FULL_:
                    case SqliteParser.GENERATED_:
                    case SqliteParser.GLOB_:
                    case SqliteParser.GROUPS_:
                    case SqliteParser.IF_:
                    case SqliteParser.IGNORE_:
                    case SqliteParser.IMMEDIATE_:
                    case SqliteParser.INDEXED_:
                    case SqliteParser.INITIALLY_:
                    case SqliteParser.INNER_:
                    case SqliteParser.INSTEAD_:
                    case SqliteParser.INTERSECT_:
                    case SqliteParser.KEY_:
                    case SqliteParser.LAST_:
                    case SqliteParser.LEFT_:
                    case SqliteParser.LIKE_:
                    case SqliteParser.MATCH_:
                    case SqliteParser.MATERIALIZED_:
                    case SqliteParser.NATURAL_:
                    case SqliteParser.NO_:
                    case SqliteParser.NULLS_:
                    case SqliteParser.OF_:
                    case SqliteParser.OFFSET_:
                    case SqliteParser.OTHERS_:
                    case SqliteParser.OUTER_:
                    case SqliteParser.PARTITION_:
                    case SqliteParser.PLAN_:
                    case SqliteParser.PRAGMA_:
                    case SqliteParser.PRECEDING_:
                    case SqliteParser.QUERY_:
                    case SqliteParser.RAISE_:
                    case SqliteParser.RANGE_:
                    case SqliteParser.RECURSIVE_:
                    case SqliteParser.REGEXP_:
                    case SqliteParser.REINDEX_:
                    case SqliteParser.RELEASE_:
                    case SqliteParser.RENAME_:
                    case SqliteParser.REPLACE_:
                    case SqliteParser.RESTRICT_:
                    case SqliteParser.RIGHT_:
                    case SqliteParser.ROLLBACK_:
                    case SqliteParser.ROW_:
                    case SqliteParser.ROWID_:
                    case SqliteParser.ROWS_:
                    case SqliteParser.SAVEPOINT_:
                    case SqliteParser.STORED_:
                    case SqliteParser.STRICT_:
                    case SqliteParser.TEMP_:
                    case SqliteParser.TEMPORARY_:
                    case SqliteParser.TIES_:
                    case SqliteParser.TRIGGER_:
                    case SqliteParser.TRUE_:
                    case SqliteParser.UNBOUNDED_:
                    case SqliteParser.UNION_:
                    case SqliteParser.VACUUM_:
                    case SqliteParser.VIEW_:
                    case SqliteParser.VIRTUAL_:
                    case SqliteParser.WITH_:
                    case SqliteParser.WITHIN_:
                    case SqliteParser.WITHOUT_:
                    case SqliteParser.IDENTIFIER:
                    case SqliteParser.STRING_LITERAL:
                        {
                        this.state = 1267;
                        this.column_name();
                        }
                        break;
                    case SqliteParser.OPEN_PAR:
                        {
                        this.state = 1268;
                        this.column_name_list();
                        }
                        break;
                    default:
                        throw new antlr.NoViableAltException(this);
                    }
                    this.state = 1271;
                    this.match(SqliteParser.ASSIGN);
                    this.state = 1272;
                    this.expr();
                    }
                    }
                    this.state = 1278;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 1281;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 175) {
                    {
                    this.state = 1279;
                    this.match(SqliteParser.WHERE_);
                    this.state = 1280;
                    this.expr();
                    }
                }

                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public pragma_stmt(): Pragma_stmtContext {
        let localContext = new Pragma_stmtContext(this.context, this.state);
        this.enterRule(localContext, 106, SqliteParser.RULE_pragma_stmt);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1285;
            this.match(SqliteParser.PRAGMA_);
            this.state = 1289;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 179, this.context) ) {
            case 1:
                {
                this.state = 1286;
                this.schema_name();
                this.state = 1287;
                this.match(SqliteParser.DOT);
                }
                break;
            }
            this.state = 1291;
            this.pragma_name();
            this.state = 1298;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.ASSIGN:
                {
                this.state = 1292;
                this.match(SqliteParser.ASSIGN);
                this.state = 1293;
                this.pragma_value();
                }
                break;
            case SqliteParser.OPEN_PAR:
                {
                this.state = 1294;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 1295;
                this.pragma_value();
                this.state = 1296;
                this.match(SqliteParser.CLOSE_PAR);
                }
                break;
            case SqliteParser.EOF:
            case SqliteParser.SCOL:
                break;
            default:
                break;
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public pragma_value(): Pragma_valueContext {
        let localContext = new Pragma_valueContext(this.context, this.state);
        this.enterRule(localContext, 108, SqliteParser.RULE_pragma_value);
        try {
            this.state = 1303;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 181, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1300;
                this.signed_number();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1301;
                this.name();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1302;
                this.match(SqliteParser.STRING_LITERAL);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public reindex_stmt(): Reindex_stmtContext {
        let localContext = new Reindex_stmtContext(this.context, this.state);
        this.enterRule(localContext, 110, SqliteParser.RULE_reindex_stmt);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1305;
            this.match(SqliteParser.REINDEX_);
            this.state = 1316;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 184, this.context) ) {
            case 1:
                {
                this.state = 1306;
                this.collation_name();
                }
                break;
            case 2:
                {
                this.state = 1310;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 182, this.context) ) {
                case 1:
                    {
                    this.state = 1307;
                    this.schema_name();
                    this.state = 1308;
                    this.match(SqliteParser.DOT);
                    }
                    break;
                }
                this.state = 1314;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 183, this.context) ) {
                case 1:
                    {
                    this.state = 1312;
                    this.table_name();
                    }
                    break;
                case 2:
                    {
                    this.state = 1313;
                    this.index_name();
                    }
                    break;
                }
                }
                break;
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public select_stmt(): Select_stmtContext {
        let localContext = new Select_stmtContext(this.context, this.state);
        this.enterRule(localContext, 112, SqliteParser.RULE_select_stmt);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1319;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 177) {
                {
                this.state = 1318;
                this.with_clause();
                }
            }

            this.state = 1321;
            this.select_core();
            this.state = 1327;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 73 || _la === 102 || _la === 166) {
                {
                {
                this.state = 1322;
                this.compound_operator();
                this.state = 1323;
                this.select_core();
                }
                }
                this.state = 1329;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 1331;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 125) {
                {
                this.state = 1330;
                this.order_clause();
                }
            }

            this.state = 1334;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 111) {
                {
                this.state = 1333;
                this.limit_clause();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public join_clause(): Join_clauseContext {
        let localContext = new Join_clauseContext(this.context, this.state);
        this.enterRule(localContext, 114, SqliteParser.RULE_join_clause);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1336;
            this.table_or_subquery();
            this.state = 1340;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 5 || _la === 54 || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 277880833) !== 0) || _la === 146) {
                {
                {
                this.state = 1337;
                this.join_step();
                }
                }
                this.state = 1342;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public join_step(): Join_stepContext {
        let localContext = new Join_stepContext(this.context, this.state);
        this.enterRule(localContext, 116, SqliteParser.RULE_join_step);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1343;
            this.join_operator();
            this.state = 1344;
            this.table_or_subquery();
            this.state = 1346;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 190, this.context) ) {
            case 1:
                {
                this.state = 1345;
                this.join_constraint();
                }
                break;
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public select_core(): Select_coreContext {
        let localContext = new Select_coreContext(this.context, this.state);
        this.enterRule(localContext, 118, SqliteParser.RULE_select_core);
        let _la: number;
        try {
            this.state = 1401;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.SELECT_:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1348;
                this.match(SqliteParser.SELECT_);
                this.state = 1350;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 31 || _la === 66) {
                    {
                    this.state = 1349;
                    _la = this.tokenStream.LA(1);
                    if(!(_la === 31 || _la === 66)) {
                    this.errorHandler.recoverInline(this);
                    }
                    else {
                        this.errorHandler.reportMatch(this);
                        this.consume();
                    }
                    }
                }

                this.state = 1352;
                this.result_column();
                this.state = 1357;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 5) {
                    {
                    {
                    this.state = 1353;
                    this.match(SqliteParser.COMMA);
                    this.state = 1354;
                    this.result_column();
                    }
                    }
                    this.state = 1359;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 1362;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 85) {
                    {
                    this.state = 1360;
                    this.match(SqliteParser.FROM_);
                    this.state = 1361;
                    this.join_clause();
                    }
                }

                this.state = 1366;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 175) {
                    {
                    this.state = 1364;
                    this.match(SqliteParser.WHERE_);
                    this.state = 1365;
                    localContext._where_expr = this.expr();
                    }
                }

                this.state = 1382;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 89) {
                    {
                    this.state = 1368;
                    this.match(SqliteParser.GROUP_);
                    this.state = 1369;
                    this.match(SqliteParser.BY_);
                    this.state = 1370;
                    localContext._expr = this.expr();
                    localContext._group_by_expr.push(localContext._expr!);
                    this.state = 1375;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    while (_la === 5) {
                        {
                        {
                        this.state = 1371;
                        this.match(SqliteParser.COMMA);
                        this.state = 1372;
                        localContext._expr = this.expr();
                        localContext._group_by_expr.push(localContext._expr!);
                        }
                        }
                        this.state = 1377;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                    }
                    this.state = 1380;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 91) {
                        {
                        this.state = 1378;
                        this.match(SqliteParser.HAVING_);
                        this.state = 1379;
                        localContext._having_expr = this.expr();
                        }
                    }

                    }
                }

                this.state = 1398;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 176) {
                    {
                    this.state = 1384;
                    this.match(SqliteParser.WINDOW_);
                    this.state = 1385;
                    this.window_name();
                    this.state = 1386;
                    this.match(SqliteParser.AS_);
                    this.state = 1387;
                    this.window_defn();
                    this.state = 1395;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    while (_la === 5) {
                        {
                        {
                        this.state = 1388;
                        this.match(SqliteParser.COMMA);
                        this.state = 1389;
                        this.window_name();
                        this.state = 1390;
                        this.match(SqliteParser.AS_);
                        this.state = 1391;
                        this.window_defn();
                        }
                        }
                        this.state = 1397;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                    }
                    }
                }

                }
                break;
            case SqliteParser.VALUES_:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1400;
                this.values_clause();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public table_or_subquery(): Table_or_subqueryContext {
        let localContext = new Table_or_subqueryContext(this.context, this.state);
        this.enterRule(localContext, 120, SqliteParser.RULE_table_or_subquery);
        let _la: number;
        try {
            this.state = 1456;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 210, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1406;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 201, this.context) ) {
                case 1:
                    {
                    this.state = 1403;
                    this.schema_name();
                    this.state = 1404;
                    this.match(SqliteParser.DOT);
                    }
                    break;
                }
                this.state = 1408;
                this.table_name();
                this.state = 1412;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 202, this.context) ) {
                case 1:
                    {
                    this.state = 1409;
                    this.match(SqliteParser.AS_);
                    this.state = 1410;
                    this.table_alias();
                    }
                    break;
                case 2:
                    {
                    this.state = 1411;
                    this.table_alias_excluding_joins();
                    }
                    break;
                }
                this.state = 1419;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case SqliteParser.INDEXED_:
                    {
                    this.state = 1414;
                    this.match(SqliteParser.INDEXED_);
                    this.state = 1415;
                    this.match(SqliteParser.BY_);
                    this.state = 1416;
                    this.index_name();
                    }
                    break;
                case SqliteParser.NOT_:
                    {
                    this.state = 1417;
                    this.match(SqliteParser.NOT_);
                    this.state = 1418;
                    this.match(SqliteParser.INDEXED_);
                    }
                    break;
                case SqliteParser.EOF:
                case SqliteParser.SCOL:
                case SqliteParser.CLOSE_PAR:
                case SqliteParser.COMMA:
                case SqliteParser.CROSS_:
                case SqliteParser.EXCEPT_:
                case SqliteParser.FULL_:
                case SqliteParser.GROUP_:
                case SqliteParser.INNER_:
                case SqliteParser.INTERSECT_:
                case SqliteParser.JOIN_:
                case SqliteParser.LEFT_:
                case SqliteParser.LIMIT_:
                case SqliteParser.NATURAL_:
                case SqliteParser.ON_:
                case SqliteParser.ORDER_:
                case SqliteParser.RETURNING_:
                case SqliteParser.RIGHT_:
                case SqliteParser.UNION_:
                case SqliteParser.USING_:
                case SqliteParser.WHERE_:
                case SqliteParser.WINDOW_:
                    break;
                default:
                    break;
                }
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1424;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 204, this.context) ) {
                case 1:
                    {
                    this.state = 1421;
                    this.schema_name();
                    this.state = 1422;
                    this.match(SqliteParser.DOT);
                    }
                    break;
                }
                this.state = 1426;
                this.table_function_name();
                this.state = 1427;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 1428;
                this.expr();
                this.state = 1433;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 5) {
                    {
                    {
                    this.state = 1429;
                    this.match(SqliteParser.COMMA);
                    this.state = 1430;
                    this.expr();
                    }
                    }
                    this.state = 1435;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 1436;
                this.match(SqliteParser.CLOSE_PAR);
                this.state = 1441;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 207, this.context) ) {
                case 1:
                    {
                    this.state = 1438;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 36) {
                        {
                        this.state = 1437;
                        this.match(SqliteParser.AS_);
                        }
                    }

                    this.state = 1440;
                    this.table_alias();
                    }
                    break;
                }
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1443;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 1444;
                this.join_clause();
                this.state = 1445;
                this.match(SqliteParser.CLOSE_PAR);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 1447;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 1448;
                this.select_stmt();
                this.state = 1449;
                this.match(SqliteParser.CLOSE_PAR);
                this.state = 1454;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 209, this.context) ) {
                case 1:
                    {
                    this.state = 1451;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 36) {
                        {
                        this.state = 1450;
                        this.match(SqliteParser.AS_);
                        }
                    }

                    this.state = 1453;
                    this.table_alias();
                    }
                    break;
                }
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public result_column(): Result_columnContext {
        let localContext = new Result_columnContext(this.context, this.state);
        this.enterRule(localContext, 122, SqliteParser.RULE_result_column);
        let _la: number;
        try {
            this.state = 1470;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 213, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1458;
                this.match(SqliteParser.STAR);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1459;
                this.table_name();
                this.state = 1460;
                this.match(SqliteParser.DOT);
                this.state = 1461;
                this.match(SqliteParser.STAR);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1463;
                this.expr();
                this.state = 1468;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 212, this.context) ) {
                case 1:
                    {
                    this.state = 1465;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 36) {
                        {
                        this.state = 1464;
                        this.match(SqliteParser.AS_);
                        }
                    }

                    this.state = 1467;
                    this.column_alias();
                    }
                    break;
                }
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public join_operator(): Join_operatorContext {
        let localContext = new Join_operatorContext(this.context, this.state);
        this.enterRule(localContext, 124, SqliteParser.RULE_join_operator);
        let _la: number;
        try {
            this.state = 1485;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.COMMA:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1472;
                this.match(SqliteParser.COMMA);
                }
                break;
            case SqliteParser.CROSS_:
            case SqliteParser.FULL_:
            case SqliteParser.INNER_:
            case SqliteParser.JOIN_:
            case SqliteParser.LEFT_:
            case SqliteParser.NATURAL_:
            case SqliteParser.RIGHT_:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1474;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 114) {
                    {
                    this.state = 1473;
                    this.match(SqliteParser.NATURAL_);
                    }
                }

                this.state = 1482;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case SqliteParser.FULL_:
                case SqliteParser.LEFT_:
                case SqliteParser.RIGHT_:
                    {
                    this.state = 1476;
                    _la = this.tokenStream.LA(1);
                    if(!(_la === 86 || _la === 109 || _la === 146)) {
                    this.errorHandler.recoverInline(this);
                    }
                    else {
                        this.errorHandler.reportMatch(this);
                        this.consume();
                    }
                    this.state = 1478;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 127) {
                        {
                        this.state = 1477;
                        this.match(SqliteParser.OUTER_);
                        }
                    }

                    }
                    break;
                case SqliteParser.INNER_:
                    {
                    this.state = 1480;
                    this.match(SqliteParser.INNER_);
                    }
                    break;
                case SqliteParser.CROSS_:
                    {
                    this.state = 1481;
                    this.match(SqliteParser.CROSS_);
                    }
                    break;
                case SqliteParser.JOIN_:
                    break;
                default:
                    break;
                }
                this.state = 1484;
                this.match(SqliteParser.JOIN_);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public join_constraint(): Join_constraintContext {
        let localContext = new Join_constraintContext(this.context, this.state);
        this.enterRule(localContext, 126, SqliteParser.RULE_join_constraint);
        let _la: number;
        try {
            this.state = 1501;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.ON_:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1487;
                this.match(SqliteParser.ON_);
                this.state = 1488;
                this.expr();
                }
                break;
            case SqliteParser.USING_:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1489;
                this.match(SqliteParser.USING_);
                this.state = 1490;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 1491;
                this.column_name();
                this.state = 1496;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 5) {
                    {
                    {
                    this.state = 1492;
                    this.match(SqliteParser.COMMA);
                    this.state = 1493;
                    this.column_name();
                    }
                    }
                    this.state = 1498;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 1499;
                this.match(SqliteParser.CLOSE_PAR);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public compound_operator(): Compound_operatorContext {
        let localContext = new Compound_operatorContext(this.context, this.state);
        this.enterRule(localContext, 128, SqliteParser.RULE_compound_operator);
        let _la: number;
        try {
            this.state = 1509;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.UNION_:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1503;
                this.match(SqliteParser.UNION_);
                this.state = 1505;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 31) {
                    {
                    this.state = 1504;
                    this.match(SqliteParser.ALL_);
                    }
                }

                }
                break;
            case SqliteParser.INTERSECT_:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1507;
                this.match(SqliteParser.INTERSECT_);
                }
                break;
            case SqliteParser.EXCEPT_:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1508;
                this.match(SqliteParser.EXCEPT_);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public update_stmt(): Update_stmtContext {
        let localContext = new Update_stmtContext(this.context, this.state);
        this.enterRule(localContext, 130, SqliteParser.RULE_update_stmt);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1512;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 177) {
                {
                this.state = 1511;
                this.with_clause();
                }
            }

            this.state = 1514;
            this.match(SqliteParser.UPDATE_);
            this.state = 1517;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 124) {
                {
                this.state = 1515;
                this.match(SqliteParser.OR_);
                this.state = 1516;
                _la = this.tokenStream.LA(1);
                if(!(_la === 27 || _la === 78 || _la === 93 || _la === 143 || _la === 147)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                }
            }

            this.state = 1519;
            this.qualified_table_name();
            this.state = 1520;
            this.match(SqliteParser.SET_);
            this.state = 1523;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.ABORT_:
            case SqliteParser.ACTION_:
            case SqliteParser.AFTER_:
            case SqliteParser.ALWAYS_:
            case SqliteParser.ANALYZE_:
            case SqliteParser.ASC_:
            case SqliteParser.ATTACH_:
            case SqliteParser.BEFORE_:
            case SqliteParser.BEGIN_:
            case SqliteParser.BY_:
            case SqliteParser.CASCADE_:
            case SqliteParser.CAST_:
            case SqliteParser.COLUMN_:
            case SqliteParser.CONFLICT_:
            case SqliteParser.CROSS_:
            case SqliteParser.CURRENT_:
            case SqliteParser.CURRENT_DATE_:
            case SqliteParser.CURRENT_TIME_:
            case SqliteParser.CURRENT_TIMESTAMP_:
            case SqliteParser.DATABASE_:
            case SqliteParser.DEFERRED_:
            case SqliteParser.DESC_:
            case SqliteParser.DETACH_:
            case SqliteParser.DO_:
            case SqliteParser.EACH_:
            case SqliteParser.END_:
            case SqliteParser.EXCEPT_:
            case SqliteParser.EXCLUDE_:
            case SqliteParser.EXCLUSIVE_:
            case SqliteParser.EXPLAIN_:
            case SqliteParser.FAIL_:
            case SqliteParser.FALSE_:
            case SqliteParser.FIRST_:
            case SqliteParser.FOLLOWING_:
            case SqliteParser.FOR_:
            case SqliteParser.FULL_:
            case SqliteParser.GENERATED_:
            case SqliteParser.GLOB_:
            case SqliteParser.GROUPS_:
            case SqliteParser.IF_:
            case SqliteParser.IGNORE_:
            case SqliteParser.IMMEDIATE_:
            case SqliteParser.INDEXED_:
            case SqliteParser.INITIALLY_:
            case SqliteParser.INNER_:
            case SqliteParser.INSTEAD_:
            case SqliteParser.INTERSECT_:
            case SqliteParser.KEY_:
            case SqliteParser.LAST_:
            case SqliteParser.LEFT_:
            case SqliteParser.LIKE_:
            case SqliteParser.MATCH_:
            case SqliteParser.MATERIALIZED_:
            case SqliteParser.NATURAL_:
            case SqliteParser.NO_:
            case SqliteParser.NULLS_:
            case SqliteParser.OF_:
            case SqliteParser.OFFSET_:
            case SqliteParser.OTHERS_:
            case SqliteParser.OUTER_:
            case SqliteParser.PARTITION_:
            case SqliteParser.PLAN_:
            case SqliteParser.PRAGMA_:
            case SqliteParser.PRECEDING_:
            case SqliteParser.QUERY_:
            case SqliteParser.RAISE_:
            case SqliteParser.RANGE_:
            case SqliteParser.RECURSIVE_:
            case SqliteParser.REGEXP_:
            case SqliteParser.REINDEX_:
            case SqliteParser.RELEASE_:
            case SqliteParser.RENAME_:
            case SqliteParser.REPLACE_:
            case SqliteParser.RESTRICT_:
            case SqliteParser.RIGHT_:
            case SqliteParser.ROLLBACK_:
            case SqliteParser.ROW_:
            case SqliteParser.ROWID_:
            case SqliteParser.ROWS_:
            case SqliteParser.SAVEPOINT_:
            case SqliteParser.STORED_:
            case SqliteParser.STRICT_:
            case SqliteParser.TEMP_:
            case SqliteParser.TEMPORARY_:
            case SqliteParser.TIES_:
            case SqliteParser.TRIGGER_:
            case SqliteParser.TRUE_:
            case SqliteParser.UNBOUNDED_:
            case SqliteParser.UNION_:
            case SqliteParser.VACUUM_:
            case SqliteParser.VIEW_:
            case SqliteParser.VIRTUAL_:
            case SqliteParser.WITH_:
            case SqliteParser.WITHIN_:
            case SqliteParser.WITHOUT_:
            case SqliteParser.IDENTIFIER:
            case SqliteParser.STRING_LITERAL:
                {
                this.state = 1521;
                this.column_name();
                }
                break;
            case SqliteParser.OPEN_PAR:
                {
                this.state = 1522;
                this.column_name_list();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            this.state = 1525;
            this.match(SqliteParser.ASSIGN);
            this.state = 1526;
            this.expr();
            this.state = 1537;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 5) {
                {
                {
                this.state = 1527;
                this.match(SqliteParser.COMMA);
                this.state = 1530;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case SqliteParser.ABORT_:
                case SqliteParser.ACTION_:
                case SqliteParser.AFTER_:
                case SqliteParser.ALWAYS_:
                case SqliteParser.ANALYZE_:
                case SqliteParser.ASC_:
                case SqliteParser.ATTACH_:
                case SqliteParser.BEFORE_:
                case SqliteParser.BEGIN_:
                case SqliteParser.BY_:
                case SqliteParser.CASCADE_:
                case SqliteParser.CAST_:
                case SqliteParser.COLUMN_:
                case SqliteParser.CONFLICT_:
                case SqliteParser.CROSS_:
                case SqliteParser.CURRENT_:
                case SqliteParser.CURRENT_DATE_:
                case SqliteParser.CURRENT_TIME_:
                case SqliteParser.CURRENT_TIMESTAMP_:
                case SqliteParser.DATABASE_:
                case SqliteParser.DEFERRED_:
                case SqliteParser.DESC_:
                case SqliteParser.DETACH_:
                case SqliteParser.DO_:
                case SqliteParser.EACH_:
                case SqliteParser.END_:
                case SqliteParser.EXCEPT_:
                case SqliteParser.EXCLUDE_:
                case SqliteParser.EXCLUSIVE_:
                case SqliteParser.EXPLAIN_:
                case SqliteParser.FAIL_:
                case SqliteParser.FALSE_:
                case SqliteParser.FIRST_:
                case SqliteParser.FOLLOWING_:
                case SqliteParser.FOR_:
                case SqliteParser.FULL_:
                case SqliteParser.GENERATED_:
                case SqliteParser.GLOB_:
                case SqliteParser.GROUPS_:
                case SqliteParser.IF_:
                case SqliteParser.IGNORE_:
                case SqliteParser.IMMEDIATE_:
                case SqliteParser.INDEXED_:
                case SqliteParser.INITIALLY_:
                case SqliteParser.INNER_:
                case SqliteParser.INSTEAD_:
                case SqliteParser.INTERSECT_:
                case SqliteParser.KEY_:
                case SqliteParser.LAST_:
                case SqliteParser.LEFT_:
                case SqliteParser.LIKE_:
                case SqliteParser.MATCH_:
                case SqliteParser.MATERIALIZED_:
                case SqliteParser.NATURAL_:
                case SqliteParser.NO_:
                case SqliteParser.NULLS_:
                case SqliteParser.OF_:
                case SqliteParser.OFFSET_:
                case SqliteParser.OTHERS_:
                case SqliteParser.OUTER_:
                case SqliteParser.PARTITION_:
                case SqliteParser.PLAN_:
                case SqliteParser.PRAGMA_:
                case SqliteParser.PRECEDING_:
                case SqliteParser.QUERY_:
                case SqliteParser.RAISE_:
                case SqliteParser.RANGE_:
                case SqliteParser.RECURSIVE_:
                case SqliteParser.REGEXP_:
                case SqliteParser.REINDEX_:
                case SqliteParser.RELEASE_:
                case SqliteParser.RENAME_:
                case SqliteParser.REPLACE_:
                case SqliteParser.RESTRICT_:
                case SqliteParser.RIGHT_:
                case SqliteParser.ROLLBACK_:
                case SqliteParser.ROW_:
                case SqliteParser.ROWID_:
                case SqliteParser.ROWS_:
                case SqliteParser.SAVEPOINT_:
                case SqliteParser.STORED_:
                case SqliteParser.STRICT_:
                case SqliteParser.TEMP_:
                case SqliteParser.TEMPORARY_:
                case SqliteParser.TIES_:
                case SqliteParser.TRIGGER_:
                case SqliteParser.TRUE_:
                case SqliteParser.UNBOUNDED_:
                case SqliteParser.UNION_:
                case SqliteParser.VACUUM_:
                case SqliteParser.VIEW_:
                case SqliteParser.VIRTUAL_:
                case SqliteParser.WITH_:
                case SqliteParser.WITHIN_:
                case SqliteParser.WITHOUT_:
                case SqliteParser.IDENTIFIER:
                case SqliteParser.STRING_LITERAL:
                    {
                    this.state = 1528;
                    this.column_name();
                    }
                    break;
                case SqliteParser.OPEN_PAR:
                    {
                    this.state = 1529;
                    this.column_name_list();
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                this.state = 1532;
                this.match(SqliteParser.ASSIGN);
                this.state = 1533;
                this.expr();
                }
                }
                this.state = 1539;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 1542;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 85) {
                {
                this.state = 1540;
                this.match(SqliteParser.FROM_);
                this.state = 1541;
                this.join_clause();
                }
            }

            this.state = 1546;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 175) {
                {
                this.state = 1544;
                this.match(SqliteParser.WHERE_);
                this.state = 1545;
                this.expr();
                }
            }

            this.state = 1549;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 145) {
                {
                this.state = 1548;
                this.returning_clause();
                }
            }

            this.state = 1552;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 125) {
                {
                this.state = 1551;
                this.order_clause();
                }
            }

            this.state = 1555;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 111) {
                {
                this.state = 1554;
                this.limit_clause();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public column_name_list(): Column_name_listContext {
        let localContext = new Column_name_listContext(this.context, this.state);
        this.enterRule(localContext, 132, SqliteParser.RULE_column_name_list);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1557;
            this.match(SqliteParser.OPEN_PAR);
            this.state = 1558;
            this.column_name();
            this.state = 1563;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 5) {
                {
                {
                this.state = 1559;
                this.match(SqliteParser.COMMA);
                this.state = 1560;
                this.column_name();
                }
                }
                this.state = 1565;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 1566;
            this.match(SqliteParser.CLOSE_PAR);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public qualified_table_name(): Qualified_table_nameContext {
        let localContext = new Qualified_table_nameContext(this.context, this.state);
        this.enterRule(localContext, 134, SqliteParser.RULE_qualified_table_name);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1571;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 233, this.context) ) {
            case 1:
                {
                this.state = 1568;
                this.schema_name();
                this.state = 1569;
                this.match(SqliteParser.DOT);
                }
                break;
            }
            this.state = 1573;
            this.table_name();
            this.state = 1576;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 36) {
                {
                this.state = 1574;
                this.match(SqliteParser.AS_);
                this.state = 1575;
                this.alias();
                }
            }

            this.state = 1583;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.INDEXED_:
                {
                this.state = 1578;
                this.match(SqliteParser.INDEXED_);
                this.state = 1579;
                this.match(SqliteParser.BY_);
                this.state = 1580;
                this.index_name();
                }
                break;
            case SqliteParser.NOT_:
                {
                this.state = 1581;
                this.match(SqliteParser.NOT_);
                this.state = 1582;
                this.match(SqliteParser.INDEXED_);
                }
                break;
            case SqliteParser.EOF:
            case SqliteParser.SCOL:
            case SqliteParser.LIMIT_:
            case SqliteParser.ORDER_:
            case SqliteParser.RETURNING_:
            case SqliteParser.SET_:
            case SqliteParser.WHERE_:
                break;
            default:
                break;
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public vacuum_stmt(): Vacuum_stmtContext {
        let localContext = new Vacuum_stmtContext(this.context, this.state);
        this.enterRule(localContext, 136, SqliteParser.RULE_vacuum_stmt);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1585;
            this.match(SqliteParser.VACUUM_);
            this.state = 1587;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 27)) & ~0x1F) === 0 && ((1 << (_la - 27)) & 4182469835) !== 0) || ((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 3118323049) !== 0) || ((((_la - 92)) & ~0x1F) === 0 && ((1 << (_la - 92)) & 1895270119) !== 0) || ((((_la - 126)) & ~0x1F) === 0 && ((1 << (_la - 126)) & 3019370363) !== 0) || ((((_la - 158)) & ~0x1F) === 0 && ((1 << (_la - 158)) & 41472485) !== 0)) {
                {
                this.state = 1586;
                this.schema_name();
                }
            }

            this.state = 1591;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 103) {
                {
                this.state = 1589;
                this.match(SqliteParser.INTO_);
                this.state = 1590;
                this.filename();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public filter_clause(): Filter_clauseContext {
        let localContext = new Filter_clauseContext(this.context, this.state);
        this.enterRule(localContext, 138, SqliteParser.RULE_filter_clause);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1593;
            this.match(SqliteParser.FILTER_);
            this.state = 1594;
            this.match(SqliteParser.OPEN_PAR);
            this.state = 1595;
            this.match(SqliteParser.WHERE_);
            this.state = 1596;
            this.expr();
            this.state = 1597;
            this.match(SqliteParser.CLOSE_PAR);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public window_defn(): Window_defnContext {
        let localContext = new Window_defnContext(this.context, this.state);
        this.enterRule(localContext, 140, SqliteParser.RULE_window_defn);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1599;
            this.match(SqliteParser.OPEN_PAR);
            this.state = 1601;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 238, this.context) ) {
            case 1:
                {
                this.state = 1600;
                this.base_window_name();
                }
                break;
            }
            this.state = 1613;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 129) {
                {
                this.state = 1603;
                this.match(SqliteParser.PARTITION_);
                this.state = 1604;
                this.match(SqliteParser.BY_);
                this.state = 1605;
                this.expr();
                this.state = 1610;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 5) {
                    {
                    {
                    this.state = 1606;
                    this.match(SqliteParser.COMMA);
                    this.state = 1607;
                    this.expr();
                    }
                    }
                    this.state = 1612;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                }
            }

            this.state = 1616;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 125) {
                {
                this.state = 1615;
                this.order_clause();
                }
            }

            this.state = 1619;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 90 || _la === 136 || _la === 150) {
                {
                this.state = 1618;
                this.frame_spec();
                }
            }

            this.state = 1621;
            this.match(SqliteParser.CLOSE_PAR);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public over_clause(): Over_clauseContext {
        let localContext = new Over_clauseContext(this.context, this.state);
        this.enterRule(localContext, 142, SqliteParser.RULE_over_clause);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1623;
            this.match(SqliteParser.OVER_);
            this.state = 1648;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.ABORT_:
            case SqliteParser.ACTION_:
            case SqliteParser.AFTER_:
            case SqliteParser.ALWAYS_:
            case SqliteParser.ANALYZE_:
            case SqliteParser.ASC_:
            case SqliteParser.ATTACH_:
            case SqliteParser.BEFORE_:
            case SqliteParser.BEGIN_:
            case SqliteParser.BY_:
            case SqliteParser.CASCADE_:
            case SqliteParser.CAST_:
            case SqliteParser.COLUMN_:
            case SqliteParser.CONFLICT_:
            case SqliteParser.CROSS_:
            case SqliteParser.CURRENT_:
            case SqliteParser.CURRENT_DATE_:
            case SqliteParser.CURRENT_TIME_:
            case SqliteParser.CURRENT_TIMESTAMP_:
            case SqliteParser.DATABASE_:
            case SqliteParser.DEFERRED_:
            case SqliteParser.DESC_:
            case SqliteParser.DETACH_:
            case SqliteParser.DO_:
            case SqliteParser.EACH_:
            case SqliteParser.END_:
            case SqliteParser.EXCEPT_:
            case SqliteParser.EXCLUDE_:
            case SqliteParser.EXCLUSIVE_:
            case SqliteParser.EXPLAIN_:
            case SqliteParser.FAIL_:
            case SqliteParser.FALSE_:
            case SqliteParser.FIRST_:
            case SqliteParser.FOLLOWING_:
            case SqliteParser.FOR_:
            case SqliteParser.FULL_:
            case SqliteParser.GENERATED_:
            case SqliteParser.GLOB_:
            case SqliteParser.GROUPS_:
            case SqliteParser.IF_:
            case SqliteParser.IGNORE_:
            case SqliteParser.IMMEDIATE_:
            case SqliteParser.INDEXED_:
            case SqliteParser.INITIALLY_:
            case SqliteParser.INNER_:
            case SqliteParser.INSTEAD_:
            case SqliteParser.INTERSECT_:
            case SqliteParser.KEY_:
            case SqliteParser.LAST_:
            case SqliteParser.LEFT_:
            case SqliteParser.LIKE_:
            case SqliteParser.MATCH_:
            case SqliteParser.MATERIALIZED_:
            case SqliteParser.NATURAL_:
            case SqliteParser.NO_:
            case SqliteParser.NULLS_:
            case SqliteParser.OF_:
            case SqliteParser.OFFSET_:
            case SqliteParser.OTHERS_:
            case SqliteParser.OUTER_:
            case SqliteParser.PARTITION_:
            case SqliteParser.PLAN_:
            case SqliteParser.PRAGMA_:
            case SqliteParser.PRECEDING_:
            case SqliteParser.QUERY_:
            case SqliteParser.RAISE_:
            case SqliteParser.RANGE_:
            case SqliteParser.RECURSIVE_:
            case SqliteParser.REGEXP_:
            case SqliteParser.REINDEX_:
            case SqliteParser.RELEASE_:
            case SqliteParser.RENAME_:
            case SqliteParser.REPLACE_:
            case SqliteParser.RESTRICT_:
            case SqliteParser.RIGHT_:
            case SqliteParser.ROLLBACK_:
            case SqliteParser.ROW_:
            case SqliteParser.ROWID_:
            case SqliteParser.ROWS_:
            case SqliteParser.SAVEPOINT_:
            case SqliteParser.STORED_:
            case SqliteParser.STRICT_:
            case SqliteParser.TEMP_:
            case SqliteParser.TEMPORARY_:
            case SqliteParser.TIES_:
            case SqliteParser.TRIGGER_:
            case SqliteParser.TRUE_:
            case SqliteParser.UNBOUNDED_:
            case SqliteParser.UNION_:
            case SqliteParser.VACUUM_:
            case SqliteParser.VIEW_:
            case SqliteParser.VIRTUAL_:
            case SqliteParser.WITH_:
            case SqliteParser.WITHIN_:
            case SqliteParser.WITHOUT_:
            case SqliteParser.IDENTIFIER:
            case SqliteParser.STRING_LITERAL:
                {
                this.state = 1624;
                this.window_name();
                }
                break;
            case SqliteParser.OPEN_PAR:
                {
                this.state = 1625;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 1627;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 243, this.context) ) {
                case 1:
                    {
                    this.state = 1626;
                    this.base_window_name();
                    }
                    break;
                }
                this.state = 1639;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 129) {
                    {
                    this.state = 1629;
                    this.match(SqliteParser.PARTITION_);
                    this.state = 1630;
                    this.match(SqliteParser.BY_);
                    this.state = 1631;
                    this.expr();
                    this.state = 1636;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    while (_la === 5) {
                        {
                        {
                        this.state = 1632;
                        this.match(SqliteParser.COMMA);
                        this.state = 1633;
                        this.expr();
                        }
                        }
                        this.state = 1638;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                    }
                    }
                }

                this.state = 1642;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 125) {
                    {
                    this.state = 1641;
                    this.order_clause();
                    }
                }

                this.state = 1645;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 90 || _la === 136 || _la === 150) {
                    {
                    this.state = 1644;
                    this.frame_spec();
                    }
                }

                this.state = 1647;
                this.match(SqliteParser.CLOSE_PAR);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public frame_spec(): Frame_specContext {
        let localContext = new Frame_specContext(this.context, this.state);
        this.enterRule(localContext, 144, SqliteParser.RULE_frame_spec);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1650;
            this.frame_clause();
            this.state = 1660;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 74) {
                {
                this.state = 1651;
                this.match(SqliteParser.EXCLUDE_);
                this.state = 1658;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case SqliteParser.NO_:
                    {
                    this.state = 1652;
                    this.match(SqliteParser.NO_);
                    this.state = 1653;
                    this.match(SqliteParser.OTHERS_);
                    }
                    break;
                case SqliteParser.CURRENT_:
                    {
                    this.state = 1654;
                    this.match(SqliteParser.CURRENT_);
                    this.state = 1655;
                    this.match(SqliteParser.ROW_);
                    }
                    break;
                case SqliteParser.GROUP_:
                    {
                    this.state = 1656;
                    this.match(SqliteParser.GROUP_);
                    }
                    break;
                case SqliteParser.TIES_:
                    {
                    this.state = 1657;
                    this.match(SqliteParser.TIES_);
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public frame_clause(): Frame_clauseContext {
        let localContext = new Frame_clauseContext(this.context, this.state);
        this.enterRule(localContext, 146, SqliteParser.RULE_frame_clause);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1662;
            _la = this.tokenStream.LA(1);
            if(!(_la === 90 || _la === 136 || _la === 150)) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            this.state = 1669;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.OPEN_PAR:
            case SqliteParser.PLUS:
            case SqliteParser.MINUS:
            case SqliteParser.TILDE:
            case SqliteParser.ABORT_:
            case SqliteParser.ACTION_:
            case SqliteParser.AFTER_:
            case SqliteParser.ALWAYS_:
            case SqliteParser.ANALYZE_:
            case SqliteParser.ASC_:
            case SqliteParser.ATTACH_:
            case SqliteParser.BEFORE_:
            case SqliteParser.BEGIN_:
            case SqliteParser.BY_:
            case SqliteParser.CASCADE_:
            case SqliteParser.CASE_:
            case SqliteParser.CAST_:
            case SqliteParser.COLUMN_:
            case SqliteParser.CONFLICT_:
            case SqliteParser.CROSS_:
            case SqliteParser.CURRENT_:
            case SqliteParser.CURRENT_DATE_:
            case SqliteParser.CURRENT_TIME_:
            case SqliteParser.CURRENT_TIMESTAMP_:
            case SqliteParser.DATABASE_:
            case SqliteParser.DEFERRED_:
            case SqliteParser.DESC_:
            case SqliteParser.DETACH_:
            case SqliteParser.DO_:
            case SqliteParser.EACH_:
            case SqliteParser.END_:
            case SqliteParser.EXCEPT_:
            case SqliteParser.EXCLUDE_:
            case SqliteParser.EXCLUSIVE_:
            case SqliteParser.EXISTS_:
            case SqliteParser.EXPLAIN_:
            case SqliteParser.FAIL_:
            case SqliteParser.FALSE_:
            case SqliteParser.FIRST_:
            case SqliteParser.FOLLOWING_:
            case SqliteParser.FOR_:
            case SqliteParser.FULL_:
            case SqliteParser.GENERATED_:
            case SqliteParser.GLOB_:
            case SqliteParser.GROUPS_:
            case SqliteParser.IF_:
            case SqliteParser.IGNORE_:
            case SqliteParser.IMMEDIATE_:
            case SqliteParser.INDEXED_:
            case SqliteParser.INITIALLY_:
            case SqliteParser.INNER_:
            case SqliteParser.INSTEAD_:
            case SqliteParser.INTERSECT_:
            case SqliteParser.KEY_:
            case SqliteParser.LAST_:
            case SqliteParser.LEFT_:
            case SqliteParser.LIKE_:
            case SqliteParser.MATCH_:
            case SqliteParser.MATERIALIZED_:
            case SqliteParser.NATURAL_:
            case SqliteParser.NO_:
            case SqliteParser.NOT_:
            case SqliteParser.NULL_:
            case SqliteParser.NULLS_:
            case SqliteParser.OF_:
            case SqliteParser.OFFSET_:
            case SqliteParser.OTHERS_:
            case SqliteParser.OUTER_:
            case SqliteParser.PARTITION_:
            case SqliteParser.PLAN_:
            case SqliteParser.PRAGMA_:
            case SqliteParser.PRECEDING_:
            case SqliteParser.QUERY_:
            case SqliteParser.RAISE_:
            case SqliteParser.RANGE_:
            case SqliteParser.RECURSIVE_:
            case SqliteParser.REGEXP_:
            case SqliteParser.REINDEX_:
            case SqliteParser.RELEASE_:
            case SqliteParser.RENAME_:
            case SqliteParser.REPLACE_:
            case SqliteParser.RESTRICT_:
            case SqliteParser.RIGHT_:
            case SqliteParser.ROLLBACK_:
            case SqliteParser.ROW_:
            case SqliteParser.ROWID_:
            case SqliteParser.ROWS_:
            case SqliteParser.SAVEPOINT_:
            case SqliteParser.STORED_:
            case SqliteParser.STRICT_:
            case SqliteParser.TEMP_:
            case SqliteParser.TEMPORARY_:
            case SqliteParser.TIES_:
            case SqliteParser.TRIGGER_:
            case SqliteParser.TRUE_:
            case SqliteParser.UNBOUNDED_:
            case SqliteParser.UNION_:
            case SqliteParser.VACUUM_:
            case SqliteParser.VIEW_:
            case SqliteParser.VIRTUAL_:
            case SqliteParser.WITH_:
            case SqliteParser.WITHIN_:
            case SqliteParser.WITHOUT_:
            case SqliteParser.IDENTIFIER:
            case SqliteParser.NUMERIC_LITERAL:
            case SqliteParser.BIND_PARAMETER:
            case SqliteParser.STRING_LITERAL:
            case SqliteParser.BLOB_LITERAL:
                {
                this.state = 1663;
                this.frame_single();
                }
                break;
            case SqliteParser.BETWEEN_:
                {
                this.state = 1664;
                this.match(SqliteParser.BETWEEN_);
                this.state = 1665;
                this.frame_left();
                this.state = 1666;
                this.match(SqliteParser.AND_);
                this.state = 1667;
                this.frame_right();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public order_clause(): Order_clauseContext {
        let localContext = new Order_clauseContext(this.context, this.state);
        this.enterRule(localContext, 148, SqliteParser.RULE_order_clause);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1671;
            this.match(SqliteParser.ORDER_);
            this.state = 1672;
            this.match(SqliteParser.BY_);
            this.state = 1673;
            this.ordering_term();
            this.state = 1678;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 5) {
                {
                {
                this.state = 1674;
                this.match(SqliteParser.COMMA);
                this.state = 1675;
                this.ordering_term();
                }
                }
                this.state = 1680;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public limit_clause(): Limit_clauseContext {
        let localContext = new Limit_clauseContext(this.context, this.state);
        this.enterRule(localContext, 150, SqliteParser.RULE_limit_clause);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1681;
            this.match(SqliteParser.LIMIT_);
            this.state = 1682;
            this.expr();
            this.state = 1685;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 5 || _la === 122) {
                {
                this.state = 1683;
                _la = this.tokenStream.LA(1);
                if(!(_la === 5 || _la === 122)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 1684;
                this.expr();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public ordering_term(): Ordering_termContext {
        let localContext = new Ordering_termContext(this.context, this.state);
        this.enterRule(localContext, 152, SqliteParser.RULE_ordering_term);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1687;
            this.expr();
            this.state = 1690;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 48) {
                {
                this.state = 1688;
                this.match(SqliteParser.COLLATE_);
                this.state = 1689;
                this.collation_name();
                }
            }

            this.state = 1693;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 37 || _la === 64) {
                {
                this.state = 1692;
                this.asc_desc();
                }
            }

            this.state = 1697;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 120) {
                {
                this.state = 1695;
                this.match(SqliteParser.NULLS_);
                this.state = 1696;
                _la = this.tokenStream.LA(1);
                if(!(_la === 81 || _la === 108)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public asc_desc(): Asc_descContext {
        let localContext = new Asc_descContext(this.context, this.state);
        this.enterRule(localContext, 154, SqliteParser.RULE_asc_desc);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1699;
            _la = this.tokenStream.LA(1);
            if(!(_la === 37 || _la === 64)) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public frame_left(): Frame_leftContext {
        let localContext = new Frame_leftContext(this.context, this.state);
        this.enterRule(localContext, 156, SqliteParser.RULE_frame_left);
        try {
            this.state = 1709;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 257, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1701;
                this.expr();
                this.state = 1702;
                this.match(SqliteParser.PRECEDING_);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1704;
                this.expr();
                this.state = 1705;
                this.match(SqliteParser.FOLLOWING_);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1707;
                this.match(SqliteParser.CURRENT_);
                this.state = 1708;
                this.match(SqliteParser.ROW_);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public frame_right(): Frame_rightContext {
        let localContext = new Frame_rightContext(this.context, this.state);
        this.enterRule(localContext, 158, SqliteParser.RULE_frame_right);
        try {
            this.state = 1719;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 258, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1711;
                this.expr();
                this.state = 1712;
                this.match(SqliteParser.PRECEDING_);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1714;
                this.expr();
                this.state = 1715;
                this.match(SqliteParser.FOLLOWING_);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1717;
                this.match(SqliteParser.CURRENT_);
                this.state = 1718;
                this.match(SqliteParser.ROW_);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public frame_single(): Frame_singleContext {
        let localContext = new Frame_singleContext(this.context, this.state);
        this.enterRule(localContext, 160, SqliteParser.RULE_frame_single);
        try {
            this.state = 1726;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 259, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1721;
                this.expr();
                this.state = 1722;
                this.match(SqliteParser.PRECEDING_);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1724;
                this.match(SqliteParser.CURRENT_);
                this.state = 1725;
                this.match(SqliteParser.ROW_);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public error_message(): Error_messageContext {
        let localContext = new Error_messageContext(this.context, this.state);
        this.enterRule(localContext, 162, SqliteParser.RULE_error_message);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1728;
            this.expr();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public filename(): FilenameContext {
        let localContext = new FilenameContext(this.context, this.state);
        this.enterRule(localContext, 164, SqliteParser.RULE_filename);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1730;
            this.expr();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public module_argument(): Module_argumentContext {
        let localContext = new Module_argumentContext(this.context, this.state);
        this.enterRule(localContext, 166, SqliteParser.RULE_module_argument);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1735;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4294967246) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 4294967295) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 4294967295) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 4294967295) !== 0) || ((((_la - 128)) & ~0x1F) === 0 && ((1 << (_la - 128)) & 4294967295) !== 0) || ((((_la - 160)) & ~0x1F) === 0 && ((1 << (_la - 160)) & 268435455) !== 0)) {
                {
                {
                this.state = 1732;
                this.module_argument_outer();
                }
                }
                this.state = 1737;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public module_argument_outer(): Module_argument_outerContext {
        let localContext = new Module_argument_outerContext(this.context, this.state);
        this.enterRule(localContext, 168, SqliteParser.RULE_module_argument_outer);
        let _la: number;
        try {
            this.state = 1747;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.SCOL:
            case SqliteParser.DOT:
            case SqliteParser.ASSIGN:
            case SqliteParser.STAR:
            case SqliteParser.PLUS:
            case SqliteParser.MINUS:
            case SqliteParser.TILDE:
            case SqliteParser.PIPE2:
            case SqliteParser.DIV:
            case SqliteParser.MOD:
            case SqliteParser.LT2:
            case SqliteParser.GT2:
            case SqliteParser.AMP:
            case SqliteParser.PIPE:
            case SqliteParser.LT:
            case SqliteParser.LT_EQ:
            case SqliteParser.GT:
            case SqliteParser.GT_EQ:
            case SqliteParser.EQ:
            case SqliteParser.NOT_EQ1:
            case SqliteParser.NOT_EQ2:
            case SqliteParser.JPTR:
            case SqliteParser.JPTR2:
            case SqliteParser.ABORT_:
            case SqliteParser.ACTION_:
            case SqliteParser.ADD_:
            case SqliteParser.AFTER_:
            case SqliteParser.ALL_:
            case SqliteParser.ALTER_:
            case SqliteParser.ALWAYS_:
            case SqliteParser.ANALYZE_:
            case SqliteParser.AND_:
            case SqliteParser.AS_:
            case SqliteParser.ASC_:
            case SqliteParser.ATTACH_:
            case SqliteParser.AUTOINCREMENT_:
            case SqliteParser.BEFORE_:
            case SqliteParser.BEGIN_:
            case SqliteParser.BETWEEN_:
            case SqliteParser.BY_:
            case SqliteParser.CASCADE_:
            case SqliteParser.CASE_:
            case SqliteParser.CAST_:
            case SqliteParser.CHECK_:
            case SqliteParser.COLLATE_:
            case SqliteParser.COLUMN_:
            case SqliteParser.COMMIT_:
            case SqliteParser.CONFLICT_:
            case SqliteParser.CONSTRAINT_:
            case SqliteParser.CREATE_:
            case SqliteParser.CROSS_:
            case SqliteParser.CURRENT_:
            case SqliteParser.CURRENT_DATE_:
            case SqliteParser.CURRENT_TIME_:
            case SqliteParser.CURRENT_TIMESTAMP_:
            case SqliteParser.DATABASE_:
            case SqliteParser.DEFAULT_:
            case SqliteParser.DEFERRABLE_:
            case SqliteParser.DEFERRED_:
            case SqliteParser.DELETE_:
            case SqliteParser.DESC_:
            case SqliteParser.DETACH_:
            case SqliteParser.DISTINCT_:
            case SqliteParser.DO_:
            case SqliteParser.DROP_:
            case SqliteParser.EACH_:
            case SqliteParser.ELSE_:
            case SqliteParser.END_:
            case SqliteParser.ESCAPE_:
            case SqliteParser.EXCEPT_:
            case SqliteParser.EXCLUDE_:
            case SqliteParser.EXCLUSIVE_:
            case SqliteParser.EXISTS_:
            case SqliteParser.EXPLAIN_:
            case SqliteParser.FAIL_:
            case SqliteParser.FALSE_:
            case SqliteParser.FILTER_:
            case SqliteParser.FIRST_:
            case SqliteParser.FOLLOWING_:
            case SqliteParser.FOR_:
            case SqliteParser.FOREIGN_:
            case SqliteParser.FROM_:
            case SqliteParser.FULL_:
            case SqliteParser.GENERATED_:
            case SqliteParser.GLOB_:
            case SqliteParser.GROUP_:
            case SqliteParser.GROUPS_:
            case SqliteParser.HAVING_:
            case SqliteParser.IF_:
            case SqliteParser.IGNORE_:
            case SqliteParser.IMMEDIATE_:
            case SqliteParser.IN_:
            case SqliteParser.INDEX_:
            case SqliteParser.INDEXED_:
            case SqliteParser.INITIALLY_:
            case SqliteParser.INNER_:
            case SqliteParser.INSERT_:
            case SqliteParser.INSTEAD_:
            case SqliteParser.INTERSECT_:
            case SqliteParser.INTO_:
            case SqliteParser.IS_:
            case SqliteParser.ISNULL_:
            case SqliteParser.JOIN_:
            case SqliteParser.KEY_:
            case SqliteParser.LAST_:
            case SqliteParser.LEFT_:
            case SqliteParser.LIKE_:
            case SqliteParser.LIMIT_:
            case SqliteParser.MATCH_:
            case SqliteParser.MATERIALIZED_:
            case SqliteParser.NATURAL_:
            case SqliteParser.NO_:
            case SqliteParser.NOT_:
            case SqliteParser.NOTHING_:
            case SqliteParser.NOTNULL_:
            case SqliteParser.NULL_:
            case SqliteParser.NULLS_:
            case SqliteParser.OF_:
            case SqliteParser.OFFSET_:
            case SqliteParser.ON_:
            case SqliteParser.OR_:
            case SqliteParser.ORDER_:
            case SqliteParser.OTHERS_:
            case SqliteParser.OUTER_:
            case SqliteParser.OVER_:
            case SqliteParser.PARTITION_:
            case SqliteParser.PLAN_:
            case SqliteParser.PRAGMA_:
            case SqliteParser.PRECEDING_:
            case SqliteParser.PRIMARY_:
            case SqliteParser.QUERY_:
            case SqliteParser.RAISE_:
            case SqliteParser.RANGE_:
            case SqliteParser.RECURSIVE_:
            case SqliteParser.REFERENCES_:
            case SqliteParser.REGEXP_:
            case SqliteParser.REINDEX_:
            case SqliteParser.RELEASE_:
            case SqliteParser.RENAME_:
            case SqliteParser.REPLACE_:
            case SqliteParser.RESTRICT_:
            case SqliteParser.RETURNING_:
            case SqliteParser.RIGHT_:
            case SqliteParser.ROLLBACK_:
            case SqliteParser.ROW_:
            case SqliteParser.ROWID_:
            case SqliteParser.ROWS_:
            case SqliteParser.SAVEPOINT_:
            case SqliteParser.SELECT_:
            case SqliteParser.SET_:
            case SqliteParser.STORED_:
            case SqliteParser.STRICT_:
            case SqliteParser.TABLE_:
            case SqliteParser.TEMP_:
            case SqliteParser.TEMPORARY_:
            case SqliteParser.THEN_:
            case SqliteParser.TIES_:
            case SqliteParser.TO_:
            case SqliteParser.TRANSACTION_:
            case SqliteParser.TRIGGER_:
            case SqliteParser.TRUE_:
            case SqliteParser.UNBOUNDED_:
            case SqliteParser.UNION_:
            case SqliteParser.UNIQUE_:
            case SqliteParser.UPDATE_:
            case SqliteParser.USING_:
            case SqliteParser.VACUUM_:
            case SqliteParser.VALUES_:
            case SqliteParser.VIEW_:
            case SqliteParser.VIRTUAL_:
            case SqliteParser.WHEN_:
            case SqliteParser.WHERE_:
            case SqliteParser.WINDOW_:
            case SqliteParser.WITH_:
            case SqliteParser.WITHIN_:
            case SqliteParser.WITHOUT_:
            case SqliteParser.IDENTIFIER:
            case SqliteParser.NUMERIC_LITERAL:
            case SqliteParser.BIND_PARAMETER:
            case SqliteParser.STRING_LITERAL:
            case SqliteParser.BLOB_LITERAL:
            case SqliteParser.SINGLE_LINE_COMMENT:
            case SqliteParser.MULTILINE_COMMENT:
            case SqliteParser.SPACES:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1738;
                _la = this.tokenStream.LA(1);
                if(_la<=0 || (((_la) & ~0x1F) === 0 && ((1 << _la) & 56) !== 0) || _la === 188) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                }
                break;
            case SqliteParser.OPEN_PAR:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1739;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 1743;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4294967278) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 4294967295) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 4294967295) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 4294967295) !== 0) || ((((_la - 128)) & ~0x1F) === 0 && ((1 << (_la - 128)) & 4294967295) !== 0) || ((((_la - 160)) & ~0x1F) === 0 && ((1 << (_la - 160)) & 268435455) !== 0)) {
                    {
                    {
                    this.state = 1740;
                    this.module_argument_inner();
                    }
                    }
                    this.state = 1745;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 1746;
                this.match(SqliteParser.CLOSE_PAR);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public module_argument_inner(): Module_argument_innerContext {
        let localContext = new Module_argument_innerContext(this.context, this.state);
        this.enterRule(localContext, 170, SqliteParser.RULE_module_argument_inner);
        let _la: number;
        try {
            this.state = 1758;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.SCOL:
            case SqliteParser.DOT:
            case SqliteParser.COMMA:
            case SqliteParser.ASSIGN:
            case SqliteParser.STAR:
            case SqliteParser.PLUS:
            case SqliteParser.MINUS:
            case SqliteParser.TILDE:
            case SqliteParser.PIPE2:
            case SqliteParser.DIV:
            case SqliteParser.MOD:
            case SqliteParser.LT2:
            case SqliteParser.GT2:
            case SqliteParser.AMP:
            case SqliteParser.PIPE:
            case SqliteParser.LT:
            case SqliteParser.LT_EQ:
            case SqliteParser.GT:
            case SqliteParser.GT_EQ:
            case SqliteParser.EQ:
            case SqliteParser.NOT_EQ1:
            case SqliteParser.NOT_EQ2:
            case SqliteParser.JPTR:
            case SqliteParser.JPTR2:
            case SqliteParser.ABORT_:
            case SqliteParser.ACTION_:
            case SqliteParser.ADD_:
            case SqliteParser.AFTER_:
            case SqliteParser.ALL_:
            case SqliteParser.ALTER_:
            case SqliteParser.ALWAYS_:
            case SqliteParser.ANALYZE_:
            case SqliteParser.AND_:
            case SqliteParser.AS_:
            case SqliteParser.ASC_:
            case SqliteParser.ATTACH_:
            case SqliteParser.AUTOINCREMENT_:
            case SqliteParser.BEFORE_:
            case SqliteParser.BEGIN_:
            case SqliteParser.BETWEEN_:
            case SqliteParser.BY_:
            case SqliteParser.CASCADE_:
            case SqliteParser.CASE_:
            case SqliteParser.CAST_:
            case SqliteParser.CHECK_:
            case SqliteParser.COLLATE_:
            case SqliteParser.COLUMN_:
            case SqliteParser.COMMIT_:
            case SqliteParser.CONFLICT_:
            case SqliteParser.CONSTRAINT_:
            case SqliteParser.CREATE_:
            case SqliteParser.CROSS_:
            case SqliteParser.CURRENT_:
            case SqliteParser.CURRENT_DATE_:
            case SqliteParser.CURRENT_TIME_:
            case SqliteParser.CURRENT_TIMESTAMP_:
            case SqliteParser.DATABASE_:
            case SqliteParser.DEFAULT_:
            case SqliteParser.DEFERRABLE_:
            case SqliteParser.DEFERRED_:
            case SqliteParser.DELETE_:
            case SqliteParser.DESC_:
            case SqliteParser.DETACH_:
            case SqliteParser.DISTINCT_:
            case SqliteParser.DO_:
            case SqliteParser.DROP_:
            case SqliteParser.EACH_:
            case SqliteParser.ELSE_:
            case SqliteParser.END_:
            case SqliteParser.ESCAPE_:
            case SqliteParser.EXCEPT_:
            case SqliteParser.EXCLUDE_:
            case SqliteParser.EXCLUSIVE_:
            case SqliteParser.EXISTS_:
            case SqliteParser.EXPLAIN_:
            case SqliteParser.FAIL_:
            case SqliteParser.FALSE_:
            case SqliteParser.FILTER_:
            case SqliteParser.FIRST_:
            case SqliteParser.FOLLOWING_:
            case SqliteParser.FOR_:
            case SqliteParser.FOREIGN_:
            case SqliteParser.FROM_:
            case SqliteParser.FULL_:
            case SqliteParser.GENERATED_:
            case SqliteParser.GLOB_:
            case SqliteParser.GROUP_:
            case SqliteParser.GROUPS_:
            case SqliteParser.HAVING_:
            case SqliteParser.IF_:
            case SqliteParser.IGNORE_:
            case SqliteParser.IMMEDIATE_:
            case SqliteParser.IN_:
            case SqliteParser.INDEX_:
            case SqliteParser.INDEXED_:
            case SqliteParser.INITIALLY_:
            case SqliteParser.INNER_:
            case SqliteParser.INSERT_:
            case SqliteParser.INSTEAD_:
            case SqliteParser.INTERSECT_:
            case SqliteParser.INTO_:
            case SqliteParser.IS_:
            case SqliteParser.ISNULL_:
            case SqliteParser.JOIN_:
            case SqliteParser.KEY_:
            case SqliteParser.LAST_:
            case SqliteParser.LEFT_:
            case SqliteParser.LIKE_:
            case SqliteParser.LIMIT_:
            case SqliteParser.MATCH_:
            case SqliteParser.MATERIALIZED_:
            case SqliteParser.NATURAL_:
            case SqliteParser.NO_:
            case SqliteParser.NOT_:
            case SqliteParser.NOTHING_:
            case SqliteParser.NOTNULL_:
            case SqliteParser.NULL_:
            case SqliteParser.NULLS_:
            case SqliteParser.OF_:
            case SqliteParser.OFFSET_:
            case SqliteParser.ON_:
            case SqliteParser.OR_:
            case SqliteParser.ORDER_:
            case SqliteParser.OTHERS_:
            case SqliteParser.OUTER_:
            case SqliteParser.OVER_:
            case SqliteParser.PARTITION_:
            case SqliteParser.PLAN_:
            case SqliteParser.PRAGMA_:
            case SqliteParser.PRECEDING_:
            case SqliteParser.PRIMARY_:
            case SqliteParser.QUERY_:
            case SqliteParser.RAISE_:
            case SqliteParser.RANGE_:
            case SqliteParser.RECURSIVE_:
            case SqliteParser.REFERENCES_:
            case SqliteParser.REGEXP_:
            case SqliteParser.REINDEX_:
            case SqliteParser.RELEASE_:
            case SqliteParser.RENAME_:
            case SqliteParser.REPLACE_:
            case SqliteParser.RESTRICT_:
            case SqliteParser.RETURNING_:
            case SqliteParser.RIGHT_:
            case SqliteParser.ROLLBACK_:
            case SqliteParser.ROW_:
            case SqliteParser.ROWID_:
            case SqliteParser.ROWS_:
            case SqliteParser.SAVEPOINT_:
            case SqliteParser.SELECT_:
            case SqliteParser.SET_:
            case SqliteParser.STORED_:
            case SqliteParser.STRICT_:
            case SqliteParser.TABLE_:
            case SqliteParser.TEMP_:
            case SqliteParser.TEMPORARY_:
            case SqliteParser.THEN_:
            case SqliteParser.TIES_:
            case SqliteParser.TO_:
            case SqliteParser.TRANSACTION_:
            case SqliteParser.TRIGGER_:
            case SqliteParser.TRUE_:
            case SqliteParser.UNBOUNDED_:
            case SqliteParser.UNION_:
            case SqliteParser.UNIQUE_:
            case SqliteParser.UPDATE_:
            case SqliteParser.USING_:
            case SqliteParser.VACUUM_:
            case SqliteParser.VALUES_:
            case SqliteParser.VIEW_:
            case SqliteParser.VIRTUAL_:
            case SqliteParser.WHEN_:
            case SqliteParser.WHERE_:
            case SqliteParser.WINDOW_:
            case SqliteParser.WITH_:
            case SqliteParser.WITHIN_:
            case SqliteParser.WITHOUT_:
            case SqliteParser.IDENTIFIER:
            case SqliteParser.NUMERIC_LITERAL:
            case SqliteParser.BIND_PARAMETER:
            case SqliteParser.STRING_LITERAL:
            case SqliteParser.BLOB_LITERAL:
            case SqliteParser.SINGLE_LINE_COMMENT:
            case SqliteParser.MULTILINE_COMMENT:
            case SqliteParser.SPACES:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1749;
                _la = this.tokenStream.LA(1);
                if(_la<=0 || _la === 3 || _la === 4 || _la === 188) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                }
                break;
            case SqliteParser.OPEN_PAR:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1750;
                this.match(SqliteParser.OPEN_PAR);
                this.state = 1754;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4294967278) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 4294967295) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 4294967295) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 4294967295) !== 0) || ((((_la - 128)) & ~0x1F) === 0 && ((1 << (_la - 128)) & 4294967295) !== 0) || ((((_la - 160)) & ~0x1F) === 0 && ((1 << (_la - 160)) & 268435455) !== 0)) {
                    {
                    {
                    this.state = 1751;
                    this.module_argument_inner();
                    }
                    }
                    this.state = 1756;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 1757;
                this.match(SqliteParser.CLOSE_PAR);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public fallback_excluding_conflicts(): Fallback_excluding_conflictsContext {
        let localContext = new Fallback_excluding_conflictsContext(this.context, this.state);
        this.enterRule(localContext, 172, SqliteParser.RULE_fallback_excluding_conflicts);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1760;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 27)) & ~0x1F) === 0 && ((1 << (_la - 27)) & 4048252107) !== 0) || ((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 2984105321) !== 0) || ((((_la - 92)) & ~0x1F) === 0 && ((1 << (_la - 92)) & 1890944583) !== 0) || ((((_la - 126)) & ~0x1F) === 0 && ((1 << (_la - 126)) & 3018321273) !== 0) || ((((_la - 158)) & ~0x1F) === 0 && ((1 << (_la - 158)) & 3723749) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public join_keyword(): Join_keywordContext {
        let localContext = new Join_keywordContext(this.context, this.state);
        this.enterRule(localContext, 174, SqliteParser.RULE_join_keyword);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1762;
            _la = this.tokenStream.LA(1);
            if(!(_la === 54 || ((((_la - 86)) & ~0x1F) === 0 && ((1 << (_la - 86)) & 276834305) !== 0) || _la === 127 || _la === 146)) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public fallback(): FallbackContext {
        let localContext = new FallbackContext(this.context, this.state);
        this.enterRule(localContext, 176, SqliteParser.RULE_fallback);
        try {
            this.state = 1767;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.ABORT_:
            case SqliteParser.ACTION_:
            case SqliteParser.AFTER_:
            case SqliteParser.ALWAYS_:
            case SqliteParser.ANALYZE_:
            case SqliteParser.ASC_:
            case SqliteParser.ATTACH_:
            case SqliteParser.BEFORE_:
            case SqliteParser.BEGIN_:
            case SqliteParser.BY_:
            case SqliteParser.CASCADE_:
            case SqliteParser.CAST_:
            case SqliteParser.COLUMN_:
            case SqliteParser.CONFLICT_:
            case SqliteParser.CURRENT_:
            case SqliteParser.CURRENT_DATE_:
            case SqliteParser.CURRENT_TIME_:
            case SqliteParser.CURRENT_TIMESTAMP_:
            case SqliteParser.DATABASE_:
            case SqliteParser.DEFERRED_:
            case SqliteParser.DESC_:
            case SqliteParser.DETACH_:
            case SqliteParser.DO_:
            case SqliteParser.EACH_:
            case SqliteParser.END_:
            case SqliteParser.EXCEPT_:
            case SqliteParser.EXCLUDE_:
            case SqliteParser.EXCLUSIVE_:
            case SqliteParser.EXPLAIN_:
            case SqliteParser.FAIL_:
            case SqliteParser.FALSE_:
            case SqliteParser.FIRST_:
            case SqliteParser.FOLLOWING_:
            case SqliteParser.FOR_:
            case SqliteParser.GENERATED_:
            case SqliteParser.GLOB_:
            case SqliteParser.GROUPS_:
            case SqliteParser.IF_:
            case SqliteParser.IGNORE_:
            case SqliteParser.IMMEDIATE_:
            case SqliteParser.INITIALLY_:
            case SqliteParser.INSTEAD_:
            case SqliteParser.INTERSECT_:
            case SqliteParser.KEY_:
            case SqliteParser.LAST_:
            case SqliteParser.LIKE_:
            case SqliteParser.MATCH_:
            case SqliteParser.MATERIALIZED_:
            case SqliteParser.NO_:
            case SqliteParser.NULLS_:
            case SqliteParser.OF_:
            case SqliteParser.OFFSET_:
            case SqliteParser.OTHERS_:
            case SqliteParser.PARTITION_:
            case SqliteParser.PLAN_:
            case SqliteParser.PRAGMA_:
            case SqliteParser.PRECEDING_:
            case SqliteParser.QUERY_:
            case SqliteParser.RANGE_:
            case SqliteParser.RECURSIVE_:
            case SqliteParser.REGEXP_:
            case SqliteParser.REINDEX_:
            case SqliteParser.RELEASE_:
            case SqliteParser.RENAME_:
            case SqliteParser.REPLACE_:
            case SqliteParser.RESTRICT_:
            case SqliteParser.ROLLBACK_:
            case SqliteParser.ROW_:
            case SqliteParser.ROWID_:
            case SqliteParser.ROWS_:
            case SqliteParser.SAVEPOINT_:
            case SqliteParser.STORED_:
            case SqliteParser.STRICT_:
            case SqliteParser.TEMP_:
            case SqliteParser.TEMPORARY_:
            case SqliteParser.TIES_:
            case SqliteParser.TRIGGER_:
            case SqliteParser.TRUE_:
            case SqliteParser.UNBOUNDED_:
            case SqliteParser.UNION_:
            case SqliteParser.VACUUM_:
            case SqliteParser.VIEW_:
            case SqliteParser.VIRTUAL_:
            case SqliteParser.WITH_:
            case SqliteParser.WITHIN_:
            case SqliteParser.WITHOUT_:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1764;
                this.fallback_excluding_conflicts();
                }
                break;
            case SqliteParser.CROSS_:
            case SqliteParser.FULL_:
            case SqliteParser.INDEXED_:
            case SqliteParser.INNER_:
            case SqliteParser.LEFT_:
            case SqliteParser.NATURAL_:
            case SqliteParser.OUTER_:
            case SqliteParser.RIGHT_:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1765;
                this.join_keyword();
                }
                break;
            case SqliteParser.RAISE_:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1766;
                this.match(SqliteParser.RAISE_);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public name(): NameContext {
        let localContext = new NameContext(this.context, this.state);
        this.enterRule(localContext, 178, SqliteParser.RULE_name);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1769;
            this.any_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public function_name(): Function_nameContext {
        let localContext = new Function_nameContext(this.context, this.state);
        this.enterRule(localContext, 180, SqliteParser.RULE_function_name);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1771;
            this.any_name_excluding_raise();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public schema_name(): Schema_nameContext {
        let localContext = new Schema_nameContext(this.context, this.state);
        this.enterRule(localContext, 182, SqliteParser.RULE_schema_name);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1773;
            this.any_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public table_name(): Table_nameContext {
        let localContext = new Table_nameContext(this.context, this.state);
        this.enterRule(localContext, 184, SqliteParser.RULE_table_name);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1775;
            this.any_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public table_or_index_name(): Table_or_index_nameContext {
        let localContext = new Table_or_index_nameContext(this.context, this.state);
        this.enterRule(localContext, 186, SqliteParser.RULE_table_or_index_name);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1777;
            this.any_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public column_name(): Column_nameContext {
        let localContext = new Column_nameContext(this.context, this.state);
        this.enterRule(localContext, 188, SqliteParser.RULE_column_name);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1779;
            this.any_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public column_name_excluding_string(): Column_name_excluding_stringContext {
        let localContext = new Column_name_excluding_stringContext(this.context, this.state);
        this.enterRule(localContext, 190, SqliteParser.RULE_column_name_excluding_string);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1781;
            this.any_name_excluding_string();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public column_alias(): Column_aliasContext {
        let localContext = new Column_aliasContext(this.context, this.state);
        this.enterRule(localContext, 192, SqliteParser.RULE_column_alias);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1783;
            this.any_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public collation_name(): Collation_nameContext {
        let localContext = new Collation_nameContext(this.context, this.state);
        this.enterRule(localContext, 194, SqliteParser.RULE_collation_name);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1785;
            this.any_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public foreign_table(): Foreign_tableContext {
        let localContext = new Foreign_tableContext(this.context, this.state);
        this.enterRule(localContext, 196, SqliteParser.RULE_foreign_table);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1787;
            this.any_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public index_name(): Index_nameContext {
        let localContext = new Index_nameContext(this.context, this.state);
        this.enterRule(localContext, 198, SqliteParser.RULE_index_name);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1789;
            this.any_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public trigger_name(): Trigger_nameContext {
        let localContext = new Trigger_nameContext(this.context, this.state);
        this.enterRule(localContext, 200, SqliteParser.RULE_trigger_name);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1791;
            this.any_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public view_name(): View_nameContext {
        let localContext = new View_nameContext(this.context, this.state);
        this.enterRule(localContext, 202, SqliteParser.RULE_view_name);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1793;
            this.any_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public module_name(): Module_nameContext {
        let localContext = new Module_nameContext(this.context, this.state);
        this.enterRule(localContext, 204, SqliteParser.RULE_module_name);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1795;
            this.any_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public pragma_name(): Pragma_nameContext {
        let localContext = new Pragma_nameContext(this.context, this.state);
        this.enterRule(localContext, 206, SqliteParser.RULE_pragma_name);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1797;
            this.any_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public savepoint_name(): Savepoint_nameContext {
        let localContext = new Savepoint_nameContext(this.context, this.state);
        this.enterRule(localContext, 208, SqliteParser.RULE_savepoint_name);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1799;
            this.any_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public table_alias(): Table_aliasContext {
        let localContext = new Table_aliasContext(this.context, this.state);
        this.enterRule(localContext, 210, SqliteParser.RULE_table_alias);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1801;
            this.any_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public table_alias_excluding_joins(): Table_alias_excluding_joinsContext {
        let localContext = new Table_alias_excluding_joinsContext(this.context, this.state);
        this.enterRule(localContext, 212, SqliteParser.RULE_table_alias_excluding_joins);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1803;
            this.any_name_excluding_joins();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public window_name(): Window_nameContext {
        let localContext = new Window_nameContext(this.context, this.state);
        this.enterRule(localContext, 214, SqliteParser.RULE_window_name);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1805;
            this.any_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public alias(): AliasContext {
        let localContext = new AliasContext(this.context, this.state);
        this.enterRule(localContext, 216, SqliteParser.RULE_alias);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1807;
            this.any_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public base_window_name(): Base_window_nameContext {
        let localContext = new Base_window_nameContext(this.context, this.state);
        this.enterRule(localContext, 218, SqliteParser.RULE_base_window_name);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1809;
            this.any_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public table_function_name(): Table_function_nameContext {
        let localContext = new Table_function_nameContext(this.context, this.state);
        this.enterRule(localContext, 220, SqliteParser.RULE_table_function_name);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1811;
            this.any_name();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public any_name_excluding_raise(): Any_name_excluding_raiseContext {
        let localContext = new Any_name_excluding_raiseContext(this.context, this.state);
        this.enterRule(localContext, 222, SqliteParser.RULE_any_name_excluding_raise);
        try {
            this.state = 1817;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1813;
                this.match(SqliteParser.IDENTIFIER);
                }
                break;
            case SqliteParser.ABORT_:
            case SqliteParser.ACTION_:
            case SqliteParser.AFTER_:
            case SqliteParser.ALWAYS_:
            case SqliteParser.ANALYZE_:
            case SqliteParser.ASC_:
            case SqliteParser.ATTACH_:
            case SqliteParser.BEFORE_:
            case SqliteParser.BEGIN_:
            case SqliteParser.BY_:
            case SqliteParser.CASCADE_:
            case SqliteParser.CAST_:
            case SqliteParser.COLUMN_:
            case SqliteParser.CONFLICT_:
            case SqliteParser.CURRENT_:
            case SqliteParser.CURRENT_DATE_:
            case SqliteParser.CURRENT_TIME_:
            case SqliteParser.CURRENT_TIMESTAMP_:
            case SqliteParser.DATABASE_:
            case SqliteParser.DEFERRED_:
            case SqliteParser.DESC_:
            case SqliteParser.DETACH_:
            case SqliteParser.DO_:
            case SqliteParser.EACH_:
            case SqliteParser.END_:
            case SqliteParser.EXCEPT_:
            case SqliteParser.EXCLUDE_:
            case SqliteParser.EXCLUSIVE_:
            case SqliteParser.EXPLAIN_:
            case SqliteParser.FAIL_:
            case SqliteParser.FALSE_:
            case SqliteParser.FIRST_:
            case SqliteParser.FOLLOWING_:
            case SqliteParser.FOR_:
            case SqliteParser.GENERATED_:
            case SqliteParser.GLOB_:
            case SqliteParser.GROUPS_:
            case SqliteParser.IF_:
            case SqliteParser.IGNORE_:
            case SqliteParser.IMMEDIATE_:
            case SqliteParser.INITIALLY_:
            case SqliteParser.INSTEAD_:
            case SqliteParser.INTERSECT_:
            case SqliteParser.KEY_:
            case SqliteParser.LAST_:
            case SqliteParser.LIKE_:
            case SqliteParser.MATCH_:
            case SqliteParser.MATERIALIZED_:
            case SqliteParser.NO_:
            case SqliteParser.NULLS_:
            case SqliteParser.OF_:
            case SqliteParser.OFFSET_:
            case SqliteParser.OTHERS_:
            case SqliteParser.PARTITION_:
            case SqliteParser.PLAN_:
            case SqliteParser.PRAGMA_:
            case SqliteParser.PRECEDING_:
            case SqliteParser.QUERY_:
            case SqliteParser.RANGE_:
            case SqliteParser.RECURSIVE_:
            case SqliteParser.REGEXP_:
            case SqliteParser.REINDEX_:
            case SqliteParser.RELEASE_:
            case SqliteParser.RENAME_:
            case SqliteParser.REPLACE_:
            case SqliteParser.RESTRICT_:
            case SqliteParser.ROLLBACK_:
            case SqliteParser.ROW_:
            case SqliteParser.ROWID_:
            case SqliteParser.ROWS_:
            case SqliteParser.SAVEPOINT_:
            case SqliteParser.STORED_:
            case SqliteParser.STRICT_:
            case SqliteParser.TEMP_:
            case SqliteParser.TEMPORARY_:
            case SqliteParser.TIES_:
            case SqliteParser.TRIGGER_:
            case SqliteParser.TRUE_:
            case SqliteParser.UNBOUNDED_:
            case SqliteParser.UNION_:
            case SqliteParser.VACUUM_:
            case SqliteParser.VIEW_:
            case SqliteParser.VIRTUAL_:
            case SqliteParser.WITH_:
            case SqliteParser.WITHIN_:
            case SqliteParser.WITHOUT_:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1814;
                this.fallback_excluding_conflicts();
                }
                break;
            case SqliteParser.CROSS_:
            case SqliteParser.FULL_:
            case SqliteParser.INDEXED_:
            case SqliteParser.INNER_:
            case SqliteParser.LEFT_:
            case SqliteParser.NATURAL_:
            case SqliteParser.OUTER_:
            case SqliteParser.RIGHT_:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1815;
                this.join_keyword();
                }
                break;
            case SqliteParser.STRING_LITERAL:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 1816;
                this.match(SqliteParser.STRING_LITERAL);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public any_name_excluding_joins(): Any_name_excluding_joinsContext {
        let localContext = new Any_name_excluding_joinsContext(this.context, this.state);
        this.enterRule(localContext, 224, SqliteParser.RULE_any_name_excluding_joins);
        try {
            this.state = 1823;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1819;
                this.match(SqliteParser.IDENTIFIER);
                }
                break;
            case SqliteParser.ABORT_:
            case SqliteParser.ACTION_:
            case SqliteParser.AFTER_:
            case SqliteParser.ALWAYS_:
            case SqliteParser.ANALYZE_:
            case SqliteParser.ASC_:
            case SqliteParser.ATTACH_:
            case SqliteParser.BEFORE_:
            case SqliteParser.BEGIN_:
            case SqliteParser.BY_:
            case SqliteParser.CASCADE_:
            case SqliteParser.CAST_:
            case SqliteParser.COLUMN_:
            case SqliteParser.CONFLICT_:
            case SqliteParser.CURRENT_:
            case SqliteParser.CURRENT_DATE_:
            case SqliteParser.CURRENT_TIME_:
            case SqliteParser.CURRENT_TIMESTAMP_:
            case SqliteParser.DATABASE_:
            case SqliteParser.DEFERRED_:
            case SqliteParser.DESC_:
            case SqliteParser.DETACH_:
            case SqliteParser.DO_:
            case SqliteParser.EACH_:
            case SqliteParser.END_:
            case SqliteParser.EXCEPT_:
            case SqliteParser.EXCLUDE_:
            case SqliteParser.EXCLUSIVE_:
            case SqliteParser.EXPLAIN_:
            case SqliteParser.FAIL_:
            case SqliteParser.FALSE_:
            case SqliteParser.FIRST_:
            case SqliteParser.FOLLOWING_:
            case SqliteParser.FOR_:
            case SqliteParser.GENERATED_:
            case SqliteParser.GLOB_:
            case SqliteParser.GROUPS_:
            case SqliteParser.IF_:
            case SqliteParser.IGNORE_:
            case SqliteParser.IMMEDIATE_:
            case SqliteParser.INITIALLY_:
            case SqliteParser.INSTEAD_:
            case SqliteParser.INTERSECT_:
            case SqliteParser.KEY_:
            case SqliteParser.LAST_:
            case SqliteParser.LIKE_:
            case SqliteParser.MATCH_:
            case SqliteParser.MATERIALIZED_:
            case SqliteParser.NO_:
            case SqliteParser.NULLS_:
            case SqliteParser.OF_:
            case SqliteParser.OFFSET_:
            case SqliteParser.OTHERS_:
            case SqliteParser.PARTITION_:
            case SqliteParser.PLAN_:
            case SqliteParser.PRAGMA_:
            case SqliteParser.PRECEDING_:
            case SqliteParser.QUERY_:
            case SqliteParser.RANGE_:
            case SqliteParser.RECURSIVE_:
            case SqliteParser.REGEXP_:
            case SqliteParser.REINDEX_:
            case SqliteParser.RELEASE_:
            case SqliteParser.RENAME_:
            case SqliteParser.REPLACE_:
            case SqliteParser.RESTRICT_:
            case SqliteParser.ROLLBACK_:
            case SqliteParser.ROW_:
            case SqliteParser.ROWID_:
            case SqliteParser.ROWS_:
            case SqliteParser.SAVEPOINT_:
            case SqliteParser.STORED_:
            case SqliteParser.STRICT_:
            case SqliteParser.TEMP_:
            case SqliteParser.TEMPORARY_:
            case SqliteParser.TIES_:
            case SqliteParser.TRIGGER_:
            case SqliteParser.TRUE_:
            case SqliteParser.UNBOUNDED_:
            case SqliteParser.UNION_:
            case SqliteParser.VACUUM_:
            case SqliteParser.VIEW_:
            case SqliteParser.VIRTUAL_:
            case SqliteParser.WITH_:
            case SqliteParser.WITHIN_:
            case SqliteParser.WITHOUT_:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1820;
                this.fallback_excluding_conflicts();
                }
                break;
            case SqliteParser.RAISE_:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1821;
                this.match(SqliteParser.RAISE_);
                }
                break;
            case SqliteParser.STRING_LITERAL:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 1822;
                this.match(SqliteParser.STRING_LITERAL);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public any_name_excluding_string(): Any_name_excluding_stringContext {
        let localContext = new Any_name_excluding_stringContext(this.context, this.state);
        this.enterRule(localContext, 226, SqliteParser.RULE_any_name_excluding_string);
        try {
            this.state = 1827;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1825;
                this.match(SqliteParser.IDENTIFIER);
                }
                break;
            case SqliteParser.ABORT_:
            case SqliteParser.ACTION_:
            case SqliteParser.AFTER_:
            case SqliteParser.ALWAYS_:
            case SqliteParser.ANALYZE_:
            case SqliteParser.ASC_:
            case SqliteParser.ATTACH_:
            case SqliteParser.BEFORE_:
            case SqliteParser.BEGIN_:
            case SqliteParser.BY_:
            case SqliteParser.CASCADE_:
            case SqliteParser.CAST_:
            case SqliteParser.COLUMN_:
            case SqliteParser.CONFLICT_:
            case SqliteParser.CROSS_:
            case SqliteParser.CURRENT_:
            case SqliteParser.CURRENT_DATE_:
            case SqliteParser.CURRENT_TIME_:
            case SqliteParser.CURRENT_TIMESTAMP_:
            case SqliteParser.DATABASE_:
            case SqliteParser.DEFERRED_:
            case SqliteParser.DESC_:
            case SqliteParser.DETACH_:
            case SqliteParser.DO_:
            case SqliteParser.EACH_:
            case SqliteParser.END_:
            case SqliteParser.EXCEPT_:
            case SqliteParser.EXCLUDE_:
            case SqliteParser.EXCLUSIVE_:
            case SqliteParser.EXPLAIN_:
            case SqliteParser.FAIL_:
            case SqliteParser.FALSE_:
            case SqliteParser.FIRST_:
            case SqliteParser.FOLLOWING_:
            case SqliteParser.FOR_:
            case SqliteParser.FULL_:
            case SqliteParser.GENERATED_:
            case SqliteParser.GLOB_:
            case SqliteParser.GROUPS_:
            case SqliteParser.IF_:
            case SqliteParser.IGNORE_:
            case SqliteParser.IMMEDIATE_:
            case SqliteParser.INDEXED_:
            case SqliteParser.INITIALLY_:
            case SqliteParser.INNER_:
            case SqliteParser.INSTEAD_:
            case SqliteParser.INTERSECT_:
            case SqliteParser.KEY_:
            case SqliteParser.LAST_:
            case SqliteParser.LEFT_:
            case SqliteParser.LIKE_:
            case SqliteParser.MATCH_:
            case SqliteParser.MATERIALIZED_:
            case SqliteParser.NATURAL_:
            case SqliteParser.NO_:
            case SqliteParser.NULLS_:
            case SqliteParser.OF_:
            case SqliteParser.OFFSET_:
            case SqliteParser.OTHERS_:
            case SqliteParser.OUTER_:
            case SqliteParser.PARTITION_:
            case SqliteParser.PLAN_:
            case SqliteParser.PRAGMA_:
            case SqliteParser.PRECEDING_:
            case SqliteParser.QUERY_:
            case SqliteParser.RAISE_:
            case SqliteParser.RANGE_:
            case SqliteParser.RECURSIVE_:
            case SqliteParser.REGEXP_:
            case SqliteParser.REINDEX_:
            case SqliteParser.RELEASE_:
            case SqliteParser.RENAME_:
            case SqliteParser.REPLACE_:
            case SqliteParser.RESTRICT_:
            case SqliteParser.RIGHT_:
            case SqliteParser.ROLLBACK_:
            case SqliteParser.ROW_:
            case SqliteParser.ROWID_:
            case SqliteParser.ROWS_:
            case SqliteParser.SAVEPOINT_:
            case SqliteParser.STORED_:
            case SqliteParser.STRICT_:
            case SqliteParser.TEMP_:
            case SqliteParser.TEMPORARY_:
            case SqliteParser.TIES_:
            case SqliteParser.TRIGGER_:
            case SqliteParser.TRUE_:
            case SqliteParser.UNBOUNDED_:
            case SqliteParser.UNION_:
            case SqliteParser.VACUUM_:
            case SqliteParser.VIEW_:
            case SqliteParser.VIRTUAL_:
            case SqliteParser.WITH_:
            case SqliteParser.WITHIN_:
            case SqliteParser.WITHOUT_:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1826;
                this.fallback();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public any_name(): Any_nameContext {
        let localContext = new Any_nameContext(this.context, this.state);
        this.enterRule(localContext, 228, SqliteParser.RULE_any_name);
        try {
            this.state = 1832;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case SqliteParser.IDENTIFIER:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1829;
                this.match(SqliteParser.IDENTIFIER);
                }
                break;
            case SqliteParser.ABORT_:
            case SqliteParser.ACTION_:
            case SqliteParser.AFTER_:
            case SqliteParser.ALWAYS_:
            case SqliteParser.ANALYZE_:
            case SqliteParser.ASC_:
            case SqliteParser.ATTACH_:
            case SqliteParser.BEFORE_:
            case SqliteParser.BEGIN_:
            case SqliteParser.BY_:
            case SqliteParser.CASCADE_:
            case SqliteParser.CAST_:
            case SqliteParser.COLUMN_:
            case SqliteParser.CONFLICT_:
            case SqliteParser.CROSS_:
            case SqliteParser.CURRENT_:
            case SqliteParser.CURRENT_DATE_:
            case SqliteParser.CURRENT_TIME_:
            case SqliteParser.CURRENT_TIMESTAMP_:
            case SqliteParser.DATABASE_:
            case SqliteParser.DEFERRED_:
            case SqliteParser.DESC_:
            case SqliteParser.DETACH_:
            case SqliteParser.DO_:
            case SqliteParser.EACH_:
            case SqliteParser.END_:
            case SqliteParser.EXCEPT_:
            case SqliteParser.EXCLUDE_:
            case SqliteParser.EXCLUSIVE_:
            case SqliteParser.EXPLAIN_:
            case SqliteParser.FAIL_:
            case SqliteParser.FALSE_:
            case SqliteParser.FIRST_:
            case SqliteParser.FOLLOWING_:
            case SqliteParser.FOR_:
            case SqliteParser.FULL_:
            case SqliteParser.GENERATED_:
            case SqliteParser.GLOB_:
            case SqliteParser.GROUPS_:
            case SqliteParser.IF_:
            case SqliteParser.IGNORE_:
            case SqliteParser.IMMEDIATE_:
            case SqliteParser.INDEXED_:
            case SqliteParser.INITIALLY_:
            case SqliteParser.INNER_:
            case SqliteParser.INSTEAD_:
            case SqliteParser.INTERSECT_:
            case SqliteParser.KEY_:
            case SqliteParser.LAST_:
            case SqliteParser.LEFT_:
            case SqliteParser.LIKE_:
            case SqliteParser.MATCH_:
            case SqliteParser.MATERIALIZED_:
            case SqliteParser.NATURAL_:
            case SqliteParser.NO_:
            case SqliteParser.NULLS_:
            case SqliteParser.OF_:
            case SqliteParser.OFFSET_:
            case SqliteParser.OTHERS_:
            case SqliteParser.OUTER_:
            case SqliteParser.PARTITION_:
            case SqliteParser.PLAN_:
            case SqliteParser.PRAGMA_:
            case SqliteParser.PRECEDING_:
            case SqliteParser.QUERY_:
            case SqliteParser.RAISE_:
            case SqliteParser.RANGE_:
            case SqliteParser.RECURSIVE_:
            case SqliteParser.REGEXP_:
            case SqliteParser.REINDEX_:
            case SqliteParser.RELEASE_:
            case SqliteParser.RENAME_:
            case SqliteParser.REPLACE_:
            case SqliteParser.RESTRICT_:
            case SqliteParser.RIGHT_:
            case SqliteParser.ROLLBACK_:
            case SqliteParser.ROW_:
            case SqliteParser.ROWID_:
            case SqliteParser.ROWS_:
            case SqliteParser.SAVEPOINT_:
            case SqliteParser.STORED_:
            case SqliteParser.STRICT_:
            case SqliteParser.TEMP_:
            case SqliteParser.TEMPORARY_:
            case SqliteParser.TIES_:
            case SqliteParser.TRIGGER_:
            case SqliteParser.TRUE_:
            case SqliteParser.UNBOUNDED_:
            case SqliteParser.UNION_:
            case SqliteParser.VACUUM_:
            case SqliteParser.VIEW_:
            case SqliteParser.VIRTUAL_:
            case SqliteParser.WITH_:
            case SqliteParser.WITHIN_:
            case SqliteParser.WITHOUT_:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1830;
                this.fallback();
                }
                break;
            case SqliteParser.STRING_LITERAL:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1831;
                this.match(SqliteParser.STRING_LITERAL);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }

    public static readonly _serializedATN: number[] = [
        4,1,188,1835,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,
        7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,
        13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
        20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,
        26,2,27,7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,
        33,7,33,2,34,7,34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,39,7,
        39,2,40,7,40,2,41,7,41,2,42,7,42,2,43,7,43,2,44,7,44,2,45,7,45,2,
        46,7,46,2,47,7,47,2,48,7,48,2,49,7,49,2,50,7,50,2,51,7,51,2,52,7,
        52,2,53,7,53,2,54,7,54,2,55,7,55,2,56,7,56,2,57,7,57,2,58,7,58,2,
        59,7,59,2,60,7,60,2,61,7,61,2,62,7,62,2,63,7,63,2,64,7,64,2,65,7,
        65,2,66,7,66,2,67,7,67,2,68,7,68,2,69,7,69,2,70,7,70,2,71,7,71,2,
        72,7,72,2,73,7,73,2,74,7,74,2,75,7,75,2,76,7,76,2,77,7,77,2,78,7,
        78,2,79,7,79,2,80,7,80,2,81,7,81,2,82,7,82,2,83,7,83,2,84,7,84,2,
        85,7,85,2,86,7,86,2,87,7,87,2,88,7,88,2,89,7,89,2,90,7,90,2,91,7,
        91,2,92,7,92,2,93,7,93,2,94,7,94,2,95,7,95,2,96,7,96,2,97,7,97,2,
        98,7,98,2,99,7,99,2,100,7,100,2,101,7,101,2,102,7,102,2,103,7,103,
        2,104,7,104,2,105,7,105,2,106,7,106,2,107,7,107,2,108,7,108,2,109,
        7,109,2,110,7,110,2,111,7,111,2,112,7,112,2,113,7,113,2,114,7,114,
        1,0,1,0,1,0,1,1,3,1,235,8,1,1,1,1,1,3,1,239,8,1,5,1,241,8,1,10,1,
        12,1,244,9,1,1,2,1,2,1,2,3,2,249,8,2,3,2,251,8,2,1,2,1,2,1,2,1,2,
        1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,
        1,2,1,2,3,2,275,8,2,1,3,1,3,1,3,1,3,1,3,3,3,282,8,3,1,3,1,3,1,3,
        1,3,1,3,3,3,289,8,3,1,3,1,3,1,3,1,3,3,3,295,8,3,1,3,1,3,3,3,299,
        8,3,1,3,1,3,1,3,3,3,304,8,3,1,3,1,3,1,3,3,3,309,8,3,3,3,311,8,3,
        1,3,1,3,3,3,315,8,3,1,3,1,3,1,3,3,3,320,8,3,1,3,1,3,3,3,324,8,3,
        1,3,1,3,1,3,1,3,1,3,3,3,331,8,3,1,3,1,3,1,3,3,3,336,8,3,3,3,338,
        8,3,1,4,1,4,1,4,1,4,1,4,3,4,345,8,4,1,4,3,4,348,8,4,1,5,1,5,3,5,
        352,8,5,1,5,1,5,1,5,1,5,1,6,1,6,3,6,360,8,6,1,6,3,6,363,8,6,1,7,
        1,7,3,7,367,8,7,1,8,1,8,3,8,371,8,8,1,8,1,8,3,8,375,8,8,1,8,3,8,
        378,8,8,1,9,1,9,1,9,1,10,1,10,3,10,385,8,10,1,10,1,10,1,11,1,11,
        3,11,391,8,11,1,11,1,11,1,11,1,11,3,11,397,8,11,1,11,1,11,1,11,3,
        11,402,8,11,1,11,1,11,1,11,1,11,1,11,1,11,1,11,5,11,411,8,11,10,
        11,12,11,414,9,11,1,11,1,11,1,11,3,11,419,8,11,1,12,1,12,1,12,3,
        12,424,8,12,1,12,3,12,427,8,12,1,13,1,13,3,13,431,8,13,1,13,1,13,
        1,13,1,13,3,13,437,8,13,1,13,1,13,1,13,3,13,442,8,13,1,13,1,13,1,
        13,1,13,1,13,5,13,449,8,13,10,13,12,13,452,9,13,1,13,1,13,5,13,456,
        8,13,10,13,12,13,459,9,13,1,13,1,13,3,13,463,8,13,1,13,1,13,3,13,
        467,8,13,1,14,1,14,1,14,3,14,472,8,14,1,14,1,14,1,14,1,14,3,14,478,
        8,14,5,14,480,8,14,10,14,12,14,483,9,14,1,15,1,15,3,15,487,8,15,
        1,15,5,15,490,8,15,10,15,12,15,493,9,15,1,16,4,16,496,8,16,11,16,
        12,16,497,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,3,16,
        510,8,16,1,17,1,17,3,17,514,8,17,1,17,1,17,1,17,3,17,519,8,17,1,
        17,3,17,522,8,17,1,17,3,17,525,8,17,1,17,3,17,528,8,17,1,17,1,17,
        3,17,532,8,17,1,17,3,17,535,8,17,1,17,1,17,1,17,1,17,1,17,1,17,1,
        17,1,17,1,17,1,17,1,17,1,17,3,17,549,8,17,1,17,1,17,1,17,1,17,1,
        17,3,17,556,8,17,1,17,1,17,1,17,1,17,1,17,3,17,563,8,17,3,17,565,
        8,17,1,18,3,18,568,8,18,1,18,1,18,1,19,1,19,3,19,574,8,19,1,19,1,
        19,1,19,3,19,579,8,19,1,19,1,19,1,19,1,19,5,19,585,8,19,10,19,12,
        19,588,9,19,1,19,1,19,3,19,592,8,19,1,19,1,19,1,19,1,19,1,19,1,19,
        1,19,1,19,1,19,1,19,1,19,5,19,605,8,19,10,19,12,19,608,9,19,1,19,
        1,19,1,19,3,19,613,8,19,1,20,1,20,1,20,1,20,1,20,1,20,5,20,621,8,
        20,10,20,12,20,624,9,20,1,20,1,20,3,20,628,8,20,1,20,1,20,1,20,1,
        20,1,20,1,20,1,20,1,20,3,20,638,8,20,1,20,1,20,5,20,642,8,20,10,
        20,12,20,645,9,20,1,20,3,20,648,8,20,1,20,1,20,1,20,3,20,653,8,20,
        3,20,655,8,20,1,21,1,21,1,21,1,21,1,22,1,22,3,22,663,8,22,1,22,1,
        22,1,22,1,22,3,22,669,8,22,1,22,1,22,1,22,3,22,674,8,22,1,22,1,22,
        1,22,1,22,1,22,3,22,681,8,22,1,22,1,22,1,22,1,22,1,22,1,22,1,22,
        5,22,690,8,22,10,22,12,22,693,9,22,3,22,695,8,22,3,22,697,8,22,1,
        22,1,22,1,22,1,22,1,22,3,22,704,8,22,1,22,1,22,3,22,708,8,22,1,22,
        1,22,1,22,1,22,1,22,3,22,715,8,22,1,22,1,22,4,22,719,8,22,11,22,
        12,22,720,1,22,1,22,1,23,1,23,3,23,727,8,23,1,23,1,23,1,23,1,23,
        3,23,733,8,23,1,23,1,23,1,23,3,23,738,8,23,1,23,1,23,1,23,1,23,1,
        23,5,23,745,8,23,10,23,12,23,748,9,23,1,23,1,23,3,23,752,8,23,1,
        23,1,23,1,23,1,24,1,24,1,24,1,24,1,24,1,24,3,24,763,8,24,1,24,1,
        24,1,24,3,24,768,8,24,1,24,1,24,1,24,1,24,1,24,1,24,1,24,5,24,777,
        8,24,10,24,12,24,780,9,24,1,24,1,24,3,24,784,8,24,1,25,1,25,3,25,
        788,8,25,1,25,1,25,1,25,5,25,793,8,25,10,25,12,25,796,9,25,1,26,
        1,26,1,26,3,26,801,8,26,1,26,3,26,804,8,26,1,26,1,26,1,26,1,26,1,
        27,1,27,1,27,1,27,1,27,5,27,815,8,27,10,27,12,27,818,9,27,1,27,1,
        27,3,27,822,8,27,1,28,3,28,825,8,28,1,28,1,28,1,28,1,28,1,28,3,28,
        832,8,28,1,28,3,28,835,8,28,1,28,3,28,838,8,28,1,28,3,28,841,8,28,
        1,29,1,29,3,29,845,8,29,1,29,1,29,1,30,1,30,1,30,1,30,3,30,853,8,
        30,1,30,1,30,1,30,3,30,858,8,30,1,30,1,30,1,31,1,31,1,32,1,32,1,
        32,5,32,867,8,32,10,32,12,32,870,9,32,1,33,1,33,1,33,5,33,875,8,
        33,10,33,12,33,878,9,33,1,34,5,34,881,8,34,10,34,12,34,884,9,34,
        1,34,1,34,1,35,1,35,1,35,1,35,1,35,3,35,893,8,35,1,35,1,35,3,35,
        897,8,35,1,35,1,35,3,35,901,8,35,1,35,1,35,1,35,1,35,1,35,1,35,3,
        35,909,8,35,1,35,1,35,1,35,1,35,1,35,1,35,5,35,917,8,35,10,35,12,
        35,920,9,35,3,35,922,8,35,1,35,1,35,1,35,1,35,3,35,928,8,35,1,35,
        1,35,1,35,1,35,3,35,934,8,35,1,35,1,35,1,35,1,35,1,35,5,35,941,8,
        35,10,35,12,35,944,9,35,3,35,946,8,35,1,35,1,35,3,35,950,8,35,1,
        35,3,35,953,8,35,1,35,1,35,1,35,1,35,3,35,959,8,35,1,35,1,35,3,35,
        963,8,35,1,35,1,35,1,35,1,35,5,35,969,8,35,10,35,12,35,972,9,35,
        1,36,1,36,1,36,5,36,977,8,36,10,36,12,36,980,9,36,1,37,1,37,1,37,
        5,37,985,8,37,10,37,12,37,988,9,37,1,38,1,38,1,38,5,38,993,8,38,
        10,38,12,38,996,9,38,1,39,1,39,1,39,5,39,1001,8,39,10,39,12,39,1004,
        9,39,1,40,1,40,1,40,5,40,1009,8,40,10,40,12,40,1012,9,40,1,41,1,
        41,1,41,5,41,1017,8,41,10,41,12,41,1020,9,41,1,42,5,42,1023,8,42,
        10,42,12,42,1026,9,42,1,42,1,42,1,43,1,43,1,43,1,43,1,43,3,43,1035,
        8,43,1,43,1,43,1,43,1,43,1,43,1,43,3,43,1043,8,43,1,43,3,43,1046,
        8,43,1,43,1,43,1,43,1,43,1,43,1,43,3,43,1054,8,43,1,44,1,44,1,44,
        3,44,1059,8,44,1,44,1,44,1,44,5,44,1064,8,44,10,44,12,44,1067,9,
        44,1,44,3,44,1070,8,44,1,44,3,44,1073,8,44,1,44,1,44,3,44,1077,8,
        44,1,44,3,44,1080,8,44,1,44,3,44,1083,8,44,1,44,1,44,1,44,1,44,5,
        44,1089,8,44,10,44,12,44,1092,9,44,1,44,1,44,1,44,1,44,1,44,1,44,
        1,44,1,44,1,44,1,44,1,44,3,44,1105,8,44,1,44,1,44,1,44,1,44,1,44,
        4,44,1112,8,44,11,44,12,44,1113,1,44,1,44,3,44,1118,8,44,1,44,1,
        44,3,44,1122,8,44,1,45,1,45,1,45,1,45,1,45,1,45,3,45,1130,8,45,1,
        45,1,45,1,46,1,46,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,47,1,48,1,
        48,1,48,1,48,5,48,1148,8,48,10,48,12,48,1151,9,48,1,48,1,48,1,49,
        1,49,1,49,1,49,5,49,1159,8,49,10,49,12,49,1162,9,49,1,50,3,50,1165,
        8,50,1,50,1,50,1,50,1,50,1,50,3,50,1172,8,50,1,50,1,50,1,50,1,50,
        3,50,1178,8,50,1,50,1,50,1,50,3,50,1183,8,50,1,50,1,50,1,50,1,50,
        5,50,1189,8,50,10,50,12,50,1192,9,50,1,50,1,50,3,50,1196,8,50,1,
        50,1,50,5,50,1200,8,50,10,50,12,50,1203,9,50,1,50,1,50,3,50,1207,
        8,50,1,50,3,50,1210,8,50,1,51,1,51,1,51,1,51,3,51,1216,8,51,1,51,
        3,51,1219,8,51,3,51,1221,8,51,1,51,1,51,1,51,1,51,3,51,1227,8,51,
        1,51,3,51,1230,8,51,3,51,1232,8,51,5,51,1234,8,51,10,51,12,51,1237,
        9,51,1,52,1,52,1,52,1,52,1,52,1,52,5,52,1245,8,52,10,52,12,52,1248,
        9,52,1,52,1,52,1,52,3,52,1253,8,52,3,52,1255,8,52,1,52,1,52,1,52,
        1,52,1,52,1,52,3,52,1263,8,52,1,52,1,52,1,52,1,52,1,52,3,52,1270,
        8,52,1,52,1,52,1,52,5,52,1275,8,52,10,52,12,52,1278,9,52,1,52,1,
        52,3,52,1282,8,52,3,52,1284,8,52,1,53,1,53,1,53,1,53,3,53,1290,8,
        53,1,53,1,53,1,53,1,53,1,53,1,53,1,53,3,53,1299,8,53,1,54,1,54,1,
        54,3,54,1304,8,54,1,55,1,55,1,55,1,55,1,55,3,55,1311,8,55,1,55,1,
        55,3,55,1315,8,55,3,55,1317,8,55,1,56,3,56,1320,8,56,1,56,1,56,1,
        56,1,56,5,56,1326,8,56,10,56,12,56,1329,9,56,1,56,3,56,1332,8,56,
        1,56,3,56,1335,8,56,1,57,1,57,5,57,1339,8,57,10,57,12,57,1342,9,
        57,1,58,1,58,1,58,3,58,1347,8,58,1,59,1,59,3,59,1351,8,59,1,59,1,
        59,1,59,5,59,1356,8,59,10,59,12,59,1359,9,59,1,59,1,59,3,59,1363,
        8,59,1,59,1,59,3,59,1367,8,59,1,59,1,59,1,59,1,59,1,59,5,59,1374,
        8,59,10,59,12,59,1377,9,59,1,59,1,59,3,59,1381,8,59,3,59,1383,8,
        59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,5,59,1394,8,59,10,
        59,12,59,1397,9,59,3,59,1399,8,59,1,59,3,59,1402,8,59,1,60,1,60,
        1,60,3,60,1407,8,60,1,60,1,60,1,60,1,60,3,60,1413,8,60,1,60,1,60,
        1,60,1,60,1,60,3,60,1420,8,60,1,60,1,60,1,60,3,60,1425,8,60,1,60,
        1,60,1,60,1,60,1,60,5,60,1432,8,60,10,60,12,60,1435,9,60,1,60,1,
        60,3,60,1439,8,60,1,60,3,60,1442,8,60,1,60,1,60,1,60,1,60,1,60,1,
        60,1,60,1,60,3,60,1452,8,60,1,60,3,60,1455,8,60,3,60,1457,8,60,1,
        61,1,61,1,61,1,61,1,61,1,61,1,61,3,61,1466,8,61,1,61,3,61,1469,8,
        61,3,61,1471,8,61,1,62,1,62,3,62,1475,8,62,1,62,1,62,3,62,1479,8,
        62,1,62,1,62,3,62,1483,8,62,1,62,3,62,1486,8,62,1,63,1,63,1,63,1,
        63,1,63,1,63,1,63,5,63,1495,8,63,10,63,12,63,1498,9,63,1,63,1,63,
        3,63,1502,8,63,1,64,1,64,3,64,1506,8,64,1,64,1,64,3,64,1510,8,64,
        1,65,3,65,1513,8,65,1,65,1,65,1,65,3,65,1518,8,65,1,65,1,65,1,65,
        1,65,3,65,1524,8,65,1,65,1,65,1,65,1,65,1,65,3,65,1531,8,65,1,65,
        1,65,1,65,5,65,1536,8,65,10,65,12,65,1539,9,65,1,65,1,65,3,65,1543,
        8,65,1,65,1,65,3,65,1547,8,65,1,65,3,65,1550,8,65,1,65,3,65,1553,
        8,65,1,65,3,65,1556,8,65,1,66,1,66,1,66,1,66,5,66,1562,8,66,10,66,
        12,66,1565,9,66,1,66,1,66,1,67,1,67,1,67,3,67,1572,8,67,1,67,1,67,
        1,67,3,67,1577,8,67,1,67,1,67,1,67,1,67,1,67,3,67,1584,8,67,1,68,
        1,68,3,68,1588,8,68,1,68,1,68,3,68,1592,8,68,1,69,1,69,1,69,1,69,
        1,69,1,69,1,70,1,70,3,70,1602,8,70,1,70,1,70,1,70,1,70,1,70,5,70,
        1609,8,70,10,70,12,70,1612,9,70,3,70,1614,8,70,1,70,3,70,1617,8,
        70,1,70,3,70,1620,8,70,1,70,1,70,1,71,1,71,1,71,1,71,3,71,1628,8,
        71,1,71,1,71,1,71,1,71,1,71,5,71,1635,8,71,10,71,12,71,1638,9,71,
        3,71,1640,8,71,1,71,3,71,1643,8,71,1,71,3,71,1646,8,71,1,71,3,71,
        1649,8,71,1,72,1,72,1,72,1,72,1,72,1,72,1,72,1,72,3,72,1659,8,72,
        3,72,1661,8,72,1,73,1,73,1,73,1,73,1,73,1,73,1,73,3,73,1670,8,73,
        1,74,1,74,1,74,1,74,1,74,5,74,1677,8,74,10,74,12,74,1680,9,74,1,
        75,1,75,1,75,1,75,3,75,1686,8,75,1,76,1,76,1,76,3,76,1691,8,76,1,
        76,3,76,1694,8,76,1,76,1,76,3,76,1698,8,76,1,77,1,77,1,78,1,78,1,
        78,1,78,1,78,1,78,1,78,1,78,3,78,1710,8,78,1,79,1,79,1,79,1,79,1,
        79,1,79,1,79,1,79,3,79,1720,8,79,1,80,1,80,1,80,1,80,1,80,3,80,1727,
        8,80,1,81,1,81,1,82,1,82,1,83,5,83,1734,8,83,10,83,12,83,1737,9,
        83,1,84,1,84,1,84,5,84,1742,8,84,10,84,12,84,1745,9,84,1,84,3,84,
        1748,8,84,1,85,1,85,1,85,5,85,1753,8,85,10,85,12,85,1756,9,85,1,
        85,3,85,1759,8,85,1,86,1,86,1,87,1,87,1,88,1,88,1,88,3,88,1768,8,
        88,1,89,1,89,1,90,1,90,1,91,1,91,1,92,1,92,1,93,1,93,1,94,1,94,1,
        95,1,95,1,96,1,96,1,97,1,97,1,98,1,98,1,99,1,99,1,100,1,100,1,101,
        1,101,1,102,1,102,1,103,1,103,1,104,1,104,1,105,1,105,1,106,1,106,
        1,107,1,107,1,108,1,108,1,109,1,109,1,110,1,110,1,111,1,111,1,111,
        1,111,3,111,1818,8,111,1,112,1,112,1,112,1,112,3,112,1824,8,112,
        1,113,1,113,3,113,1828,8,113,1,114,1,114,1,114,3,114,1833,8,114,
        1,114,2,450,497,0,115,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,
        32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,
        76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,110,112,
        114,116,118,120,122,124,126,128,130,132,134,136,138,140,142,144,
        146,148,150,152,154,156,158,160,162,164,166,168,170,172,174,176,
        178,180,182,184,186,188,190,192,194,196,198,200,202,204,206,208,
        210,212,214,216,218,220,222,224,226,228,0,29,3,0,62,62,75,75,94,
        94,2,0,50,50,71,71,1,0,157,158,2,0,154,154,173,173,1,0,8,9,2,0,63,
        63,168,168,2,0,60,60,119,119,2,0,62,62,94,94,5,0,27,27,78,78,93,
        93,143,143,147,147,4,0,96,96,156,156,163,163,172,172,2,0,6,6,22,
        24,3,0,88,88,112,112,139,139,1,0,18,21,1,0,14,17,2,0,7,7,12,13,2,
        0,11,11,25,26,1,0,8,10,3,0,27,27,78,78,147,147,6,0,56,58,79,79,119,
        119,164,164,181,181,183,184,2,0,31,31,66,66,3,0,86,86,109,109,146,
        146,3,0,90,90,136,136,150,150,2,0,5,5,122,122,2,0,81,81,108,108,
        2,0,37,37,64,64,2,0,3,5,188,188,2,0,3,4,188,188,41,0,27,28,30,30,
        33,34,37,38,40,41,43,44,46,46,49,49,51,51,55,59,62,62,64,65,67,67,
        69,69,71,71,73,75,77,79,81,83,87,88,90,90,92,94,98,98,101,102,107,
        108,110,110,112,113,115,115,120,122,126,126,129,132,134,134,136,
        137,139,144,147,151,154,155,157,158,160,160,163,166,170,170,172,
        173,177,179,8,0,54,54,86,86,97,97,99,99,109,109,114,114,127,127,
        146,146,2066,0,230,1,0,0,0,2,234,1,0,0,0,4,250,1,0,0,0,6,276,1,0,
        0,0,8,339,1,0,0,0,10,349,1,0,0,0,12,357,1,0,0,0,14,364,1,0,0,0,16,
        368,1,0,0,0,18,379,1,0,0,0,20,382,1,0,0,0,22,388,1,0,0,0,24,420,
        1,0,0,0,26,428,1,0,0,0,28,471,1,0,0,0,30,484,1,0,0,0,32,495,1,0,
        0,0,34,513,1,0,0,0,36,567,1,0,0,0,38,573,1,0,0,0,40,614,1,0,0,0,
        42,656,1,0,0,0,44,660,1,0,0,0,46,724,1,0,0,0,48,756,1,0,0,0,50,785,
        1,0,0,0,52,797,1,0,0,0,54,809,1,0,0,0,56,824,1,0,0,0,58,842,1,0,
        0,0,60,848,1,0,0,0,62,861,1,0,0,0,64,863,1,0,0,0,66,871,1,0,0,0,
        68,882,1,0,0,0,70,887,1,0,0,0,72,973,1,0,0,0,74,981,1,0,0,0,76,989,
        1,0,0,0,78,997,1,0,0,0,80,1005,1,0,0,0,82,1013,1,0,0,0,84,1024,1,
        0,0,0,86,1053,1,0,0,0,88,1121,1,0,0,0,90,1123,1,0,0,0,92,1133,1,
        0,0,0,94,1135,1,0,0,0,96,1143,1,0,0,0,98,1154,1,0,0,0,100,1164,1,
        0,0,0,102,1211,1,0,0,0,104,1238,1,0,0,0,106,1285,1,0,0,0,108,1303,
        1,0,0,0,110,1305,1,0,0,0,112,1319,1,0,0,0,114,1336,1,0,0,0,116,1343,
        1,0,0,0,118,1401,1,0,0,0,120,1456,1,0,0,0,122,1470,1,0,0,0,124,1485,
        1,0,0,0,126,1501,1,0,0,0,128,1509,1,0,0,0,130,1512,1,0,0,0,132,1557,
        1,0,0,0,134,1571,1,0,0,0,136,1585,1,0,0,0,138,1593,1,0,0,0,140,1599,
        1,0,0,0,142,1623,1,0,0,0,144,1650,1,0,0,0,146,1662,1,0,0,0,148,1671,
        1,0,0,0,150,1681,1,0,0,0,152,1687,1,0,0,0,154,1699,1,0,0,0,156,1709,
        1,0,0,0,158,1719,1,0,0,0,160,1726,1,0,0,0,162,1728,1,0,0,0,164,1730,
        1,0,0,0,166,1735,1,0,0,0,168,1747,1,0,0,0,170,1758,1,0,0,0,172,1760,
        1,0,0,0,174,1762,1,0,0,0,176,1767,1,0,0,0,178,1769,1,0,0,0,180,1771,
        1,0,0,0,182,1773,1,0,0,0,184,1775,1,0,0,0,186,1777,1,0,0,0,188,1779,
        1,0,0,0,190,1781,1,0,0,0,192,1783,1,0,0,0,194,1785,1,0,0,0,196,1787,
        1,0,0,0,198,1789,1,0,0,0,200,1791,1,0,0,0,202,1793,1,0,0,0,204,1795,
        1,0,0,0,206,1797,1,0,0,0,208,1799,1,0,0,0,210,1801,1,0,0,0,212,1803,
        1,0,0,0,214,1805,1,0,0,0,216,1807,1,0,0,0,218,1809,1,0,0,0,220,1811,
        1,0,0,0,222,1817,1,0,0,0,224,1823,1,0,0,0,226,1827,1,0,0,0,228,1832,
        1,0,0,0,230,231,3,2,1,0,231,232,5,0,0,1,232,1,1,0,0,0,233,235,3,
        4,2,0,234,233,1,0,0,0,234,235,1,0,0,0,235,242,1,0,0,0,236,238,5,
        1,0,0,237,239,3,4,2,0,238,237,1,0,0,0,238,239,1,0,0,0,239,241,1,
        0,0,0,240,236,1,0,0,0,241,244,1,0,0,0,242,240,1,0,0,0,242,243,1,
        0,0,0,243,3,1,0,0,0,244,242,1,0,0,0,245,248,5,77,0,0,246,247,5,134,
        0,0,247,249,5,130,0,0,248,246,1,0,0,0,248,249,1,0,0,0,249,251,1,
        0,0,0,250,245,1,0,0,0,250,251,1,0,0,0,251,274,1,0,0,0,252,275,3,
        6,3,0,253,275,3,8,4,0,254,275,3,10,5,0,255,275,3,12,6,0,256,275,
        3,14,7,0,257,275,3,22,11,0,258,275,3,26,13,0,259,275,3,44,22,0,260,
        275,3,46,23,0,261,275,3,48,24,0,262,275,3,56,28,0,263,275,3,58,29,
        0,264,275,3,60,30,0,265,275,3,100,50,0,266,275,3,106,53,0,267,275,
        3,110,55,0,268,275,3,20,10,0,269,275,3,16,8,0,270,275,3,18,9,0,271,
        275,3,112,56,0,272,275,3,130,65,0,273,275,3,136,68,0,274,252,1,0,
        0,0,274,253,1,0,0,0,274,254,1,0,0,0,274,255,1,0,0,0,274,256,1,0,
        0,0,274,257,1,0,0,0,274,258,1,0,0,0,274,259,1,0,0,0,274,260,1,0,
        0,0,274,261,1,0,0,0,274,262,1,0,0,0,274,263,1,0,0,0,274,264,1,0,
        0,0,274,265,1,0,0,0,274,266,1,0,0,0,274,267,1,0,0,0,274,268,1,0,
        0,0,274,269,1,0,0,0,274,270,1,0,0,0,274,271,1,0,0,0,274,272,1,0,
        0,0,274,273,1,0,0,0,275,5,1,0,0,0,276,277,5,32,0,0,277,281,5,156,
        0,0,278,279,3,182,91,0,279,280,5,2,0,0,280,282,1,0,0,0,281,278,1,
        0,0,0,281,282,1,0,0,0,282,283,1,0,0,0,283,337,3,184,92,0,284,294,
        5,142,0,0,285,286,5,161,0,0,286,295,3,184,92,0,287,289,5,49,0,0,
        288,287,1,0,0,0,288,289,1,0,0,0,289,290,1,0,0,0,290,291,3,188,94,
        0,291,292,5,161,0,0,292,293,3,188,94,0,293,295,1,0,0,0,294,285,1,
        0,0,0,294,288,1,0,0,0,295,338,1,0,0,0,296,310,5,29,0,0,297,299,5,
        49,0,0,298,297,1,0,0,0,298,299,1,0,0,0,299,300,1,0,0,0,300,311,3,
        30,15,0,301,302,5,52,0,0,302,304,3,178,89,0,303,301,1,0,0,0,303,
        304,1,0,0,0,304,305,1,0,0,0,305,306,5,47,0,0,306,308,3,62,31,0,307,
        309,3,42,21,0,308,307,1,0,0,0,308,309,1,0,0,0,309,311,1,0,0,0,310,
        298,1,0,0,0,310,303,1,0,0,0,311,338,1,0,0,0,312,319,5,68,0,0,313,
        315,5,49,0,0,314,313,1,0,0,0,314,315,1,0,0,0,315,316,1,0,0,0,316,
        320,3,188,94,0,317,318,5,52,0,0,318,320,3,178,89,0,319,314,1,0,0,
        0,319,317,1,0,0,0,320,338,1,0,0,0,321,323,5,32,0,0,322,324,5,49,
        0,0,323,322,1,0,0,0,323,324,1,0,0,0,324,325,1,0,0,0,325,335,3,188,
        94,0,326,327,5,153,0,0,327,328,5,116,0,0,328,330,5,119,0,0,329,331,
        3,42,21,0,330,329,1,0,0,0,330,331,1,0,0,0,331,336,1,0,0,0,332,333,
        5,68,0,0,333,334,5,116,0,0,334,336,5,119,0,0,335,326,1,0,0,0,335,
        332,1,0,0,0,336,338,1,0,0,0,337,284,1,0,0,0,337,296,1,0,0,0,337,
        312,1,0,0,0,337,321,1,0,0,0,338,7,1,0,0,0,339,347,5,34,0,0,340,348,
        3,182,91,0,341,342,3,182,91,0,342,343,5,2,0,0,343,345,1,0,0,0,344,
        341,1,0,0,0,344,345,1,0,0,0,345,346,1,0,0,0,346,348,3,186,93,0,347,
        340,1,0,0,0,347,344,1,0,0,0,347,348,1,0,0,0,348,9,1,0,0,0,349,351,
        5,38,0,0,350,352,5,59,0,0,351,350,1,0,0,0,351,352,1,0,0,0,352,353,
        1,0,0,0,353,354,3,62,31,0,354,355,5,36,0,0,355,356,3,182,91,0,356,
        11,1,0,0,0,357,359,5,41,0,0,358,360,7,0,0,0,359,358,1,0,0,0,359,
        360,1,0,0,0,360,362,1,0,0,0,361,363,5,162,0,0,362,361,1,0,0,0,362,
        363,1,0,0,0,363,13,1,0,0,0,364,366,7,1,0,0,365,367,5,162,0,0,366,
        365,1,0,0,0,366,367,1,0,0,0,367,15,1,0,0,0,368,370,5,147,0,0,369,
        371,5,162,0,0,370,369,1,0,0,0,370,371,1,0,0,0,371,377,1,0,0,0,372,
        374,5,161,0,0,373,375,5,151,0,0,374,373,1,0,0,0,374,375,1,0,0,0,
        375,376,1,0,0,0,376,378,3,208,104,0,377,372,1,0,0,0,377,378,1,0,
        0,0,378,17,1,0,0,0,379,380,5,151,0,0,380,381,3,208,104,0,381,19,
        1,0,0,0,382,384,5,141,0,0,383,385,5,151,0,0,384,383,1,0,0,0,384,
        385,1,0,0,0,385,386,1,0,0,0,386,387,3,208,104,0,387,21,1,0,0,0,388,
        390,5,53,0,0,389,391,5,167,0,0,390,389,1,0,0,0,390,391,1,0,0,0,391,
        392,1,0,0,0,392,396,5,96,0,0,393,394,5,92,0,0,394,395,5,116,0,0,
        395,397,5,76,0,0,396,393,1,0,0,0,396,397,1,0,0,0,397,401,1,0,0,0,
        398,399,3,182,91,0,399,400,5,2,0,0,400,402,1,0,0,0,401,398,1,0,0,
        0,401,402,1,0,0,0,402,403,1,0,0,0,403,404,3,198,99,0,404,405,5,123,
        0,0,405,406,3,184,92,0,406,407,5,3,0,0,407,412,3,24,12,0,408,409,
        5,5,0,0,409,411,3,24,12,0,410,408,1,0,0,0,411,414,1,0,0,0,412,410,
        1,0,0,0,412,413,1,0,0,0,413,415,1,0,0,0,414,412,1,0,0,0,415,418,
        5,4,0,0,416,417,5,175,0,0,417,419,3,62,31,0,418,416,1,0,0,0,418,
        419,1,0,0,0,419,23,1,0,0,0,420,423,3,62,31,0,421,422,5,48,0,0,422,
        424,3,194,97,0,423,421,1,0,0,0,423,424,1,0,0,0,424,426,1,0,0,0,425,
        427,3,154,77,0,426,425,1,0,0,0,426,427,1,0,0,0,427,25,1,0,0,0,428,
        430,5,53,0,0,429,431,7,2,0,0,430,429,1,0,0,0,430,431,1,0,0,0,431,
        432,1,0,0,0,432,436,5,156,0,0,433,434,5,92,0,0,434,435,5,116,0,0,
        435,437,5,76,0,0,436,433,1,0,0,0,436,437,1,0,0,0,437,441,1,0,0,0,
        438,439,3,182,91,0,439,440,5,2,0,0,440,442,1,0,0,0,441,438,1,0,0,
        0,441,442,1,0,0,0,442,443,1,0,0,0,443,466,3,184,92,0,444,445,5,3,
        0,0,445,450,3,30,15,0,446,447,5,5,0,0,447,449,3,30,15,0,448,446,
        1,0,0,0,449,452,1,0,0,0,450,451,1,0,0,0,450,448,1,0,0,0,451,457,
        1,0,0,0,452,450,1,0,0,0,453,454,5,5,0,0,454,456,3,38,19,0,455,453,
        1,0,0,0,456,459,1,0,0,0,457,455,1,0,0,0,457,458,1,0,0,0,458,460,
        1,0,0,0,459,457,1,0,0,0,460,462,5,4,0,0,461,463,3,28,14,0,462,461,
        1,0,0,0,462,463,1,0,0,0,463,467,1,0,0,0,464,465,5,36,0,0,465,467,
        3,112,56,0,466,444,1,0,0,0,466,464,1,0,0,0,467,27,1,0,0,0,468,469,
        5,179,0,0,469,472,5,149,0,0,470,472,5,155,0,0,471,468,1,0,0,0,471,
        470,1,0,0,0,472,481,1,0,0,0,473,477,5,5,0,0,474,475,5,179,0,0,475,
        478,5,149,0,0,476,478,5,155,0,0,477,474,1,0,0,0,477,476,1,0,0,0,
        478,480,1,0,0,0,479,473,1,0,0,0,480,483,1,0,0,0,481,479,1,0,0,0,
        481,482,1,0,0,0,482,29,1,0,0,0,483,481,1,0,0,0,484,486,3,188,94,
        0,485,487,3,32,16,0,486,485,1,0,0,0,486,487,1,0,0,0,487,491,1,0,
        0,0,488,490,3,34,17,0,489,488,1,0,0,0,490,493,1,0,0,0,491,489,1,
        0,0,0,491,492,1,0,0,0,492,31,1,0,0,0,493,491,1,0,0,0,494,496,3,178,
        89,0,495,494,1,0,0,0,496,497,1,0,0,0,497,498,1,0,0,0,497,495,1,0,
        0,0,498,509,1,0,0,0,499,500,5,3,0,0,500,501,3,36,18,0,501,502,5,
        4,0,0,502,510,1,0,0,0,503,504,5,3,0,0,504,505,3,36,18,0,505,506,
        5,5,0,0,506,507,3,36,18,0,507,508,5,4,0,0,508,510,1,0,0,0,509,499,
        1,0,0,0,509,503,1,0,0,0,509,510,1,0,0,0,510,33,1,0,0,0,511,512,5,
        52,0,0,512,514,3,178,89,0,513,511,1,0,0,0,513,514,1,0,0,0,514,564,
        1,0,0,0,515,516,5,133,0,0,516,518,5,107,0,0,517,519,3,154,77,0,518,
        517,1,0,0,0,518,519,1,0,0,0,519,521,1,0,0,0,520,522,3,42,21,0,521,
        520,1,0,0,0,521,522,1,0,0,0,522,524,1,0,0,0,523,525,5,39,0,0,524,
        523,1,0,0,0,524,525,1,0,0,0,525,565,1,0,0,0,526,528,5,116,0,0,527,
        526,1,0,0,0,527,528,1,0,0,0,528,529,1,0,0,0,529,532,5,119,0,0,530,
        532,5,167,0,0,531,527,1,0,0,0,531,530,1,0,0,0,532,534,1,0,0,0,533,
        535,3,42,21,0,534,533,1,0,0,0,534,535,1,0,0,0,535,565,1,0,0,0,536,
        537,5,47,0,0,537,538,5,3,0,0,538,539,3,62,31,0,539,540,5,4,0,0,540,
        565,1,0,0,0,541,548,5,60,0,0,542,549,3,36,18,0,543,549,3,92,46,0,
        544,545,5,3,0,0,545,546,3,62,31,0,546,547,5,4,0,0,547,549,1,0,0,
        0,548,542,1,0,0,0,548,543,1,0,0,0,548,544,1,0,0,0,549,565,1,0,0,
        0,550,551,5,48,0,0,551,565,3,194,97,0,552,565,3,40,20,0,553,554,
        5,87,0,0,554,556,5,33,0,0,555,553,1,0,0,0,555,556,1,0,0,0,556,557,
        1,0,0,0,557,558,5,36,0,0,558,559,5,3,0,0,559,560,3,62,31,0,560,562,
        5,4,0,0,561,563,7,3,0,0,562,561,1,0,0,0,562,563,1,0,0,0,563,565,
        1,0,0,0,564,515,1,0,0,0,564,531,1,0,0,0,564,536,1,0,0,0,564,541,
        1,0,0,0,564,550,1,0,0,0,564,552,1,0,0,0,564,555,1,0,0,0,565,35,1,
        0,0,0,566,568,7,4,0,0,567,566,1,0,0,0,567,568,1,0,0,0,568,569,1,
        0,0,0,569,570,5,181,0,0,570,37,1,0,0,0,571,572,5,52,0,0,572,574,
        3,178,89,0,573,571,1,0,0,0,573,574,1,0,0,0,574,612,1,0,0,0,575,576,
        5,133,0,0,576,579,5,107,0,0,577,579,5,167,0,0,578,575,1,0,0,0,578,
        577,1,0,0,0,579,580,1,0,0,0,580,581,5,3,0,0,581,586,3,24,12,0,582,
        583,5,5,0,0,583,585,3,24,12,0,584,582,1,0,0,0,585,588,1,0,0,0,586,
        584,1,0,0,0,586,587,1,0,0,0,587,589,1,0,0,0,588,586,1,0,0,0,589,
        591,5,4,0,0,590,592,3,42,21,0,591,590,1,0,0,0,591,592,1,0,0,0,592,
        613,1,0,0,0,593,594,5,47,0,0,594,595,5,3,0,0,595,596,3,62,31,0,596,
        597,5,4,0,0,597,613,1,0,0,0,598,599,5,84,0,0,599,600,5,107,0,0,600,
        601,5,3,0,0,601,606,3,188,94,0,602,603,5,5,0,0,603,605,3,188,94,
        0,604,602,1,0,0,0,605,608,1,0,0,0,606,604,1,0,0,0,606,607,1,0,0,
        0,607,609,1,0,0,0,608,606,1,0,0,0,609,610,5,4,0,0,610,611,3,40,20,
        0,611,613,1,0,0,0,612,578,1,0,0,0,612,593,1,0,0,0,612,598,1,0,0,
        0,613,39,1,0,0,0,614,615,5,138,0,0,615,627,3,196,98,0,616,617,5,
        3,0,0,617,622,3,188,94,0,618,619,5,5,0,0,619,621,3,188,94,0,620,
        618,1,0,0,0,621,624,1,0,0,0,622,620,1,0,0,0,622,623,1,0,0,0,623,
        625,1,0,0,0,624,622,1,0,0,0,625,626,5,4,0,0,626,628,1,0,0,0,627,
        616,1,0,0,0,627,628,1,0,0,0,628,643,1,0,0,0,629,630,5,123,0,0,630,
        637,7,5,0,0,631,632,5,153,0,0,632,638,7,6,0,0,633,638,5,44,0,0,634,
        638,5,144,0,0,635,636,5,115,0,0,636,638,5,28,0,0,637,631,1,0,0,0,
        637,633,1,0,0,0,637,634,1,0,0,0,637,635,1,0,0,0,638,642,1,0,0,0,
        639,640,5,112,0,0,640,642,3,178,89,0,641,629,1,0,0,0,641,639,1,0,
        0,0,642,645,1,0,0,0,643,641,1,0,0,0,643,644,1,0,0,0,644,654,1,0,
        0,0,645,643,1,0,0,0,646,648,5,116,0,0,647,646,1,0,0,0,647,648,1,
        0,0,0,648,649,1,0,0,0,649,652,5,61,0,0,650,651,5,98,0,0,651,653,
        7,7,0,0,652,650,1,0,0,0,652,653,1,0,0,0,653,655,1,0,0,0,654,647,
        1,0,0,0,654,655,1,0,0,0,655,41,1,0,0,0,656,657,5,123,0,0,657,658,
        5,51,0,0,658,659,7,8,0,0,659,43,1,0,0,0,660,662,5,53,0,0,661,663,
        7,2,0,0,662,661,1,0,0,0,662,663,1,0,0,0,663,664,1,0,0,0,664,668,
        5,163,0,0,665,666,5,92,0,0,666,667,5,116,0,0,667,669,5,76,0,0,668,
        665,1,0,0,0,668,669,1,0,0,0,669,673,1,0,0,0,670,671,3,182,91,0,671,
        672,5,2,0,0,672,674,1,0,0,0,673,670,1,0,0,0,673,674,1,0,0,0,674,
        675,1,0,0,0,675,680,3,200,100,0,676,681,5,40,0,0,677,681,5,30,0,
        0,678,679,5,101,0,0,679,681,5,121,0,0,680,676,1,0,0,0,680,677,1,
        0,0,0,680,678,1,0,0,0,680,681,1,0,0,0,681,696,1,0,0,0,682,697,5,
        63,0,0,683,697,5,100,0,0,684,694,5,168,0,0,685,686,5,121,0,0,686,
        691,3,188,94,0,687,688,5,5,0,0,688,690,3,188,94,0,689,687,1,0,0,
        0,690,693,1,0,0,0,691,689,1,0,0,0,691,692,1,0,0,0,692,695,1,0,0,
        0,693,691,1,0,0,0,694,685,1,0,0,0,694,695,1,0,0,0,695,697,1,0,0,
        0,696,682,1,0,0,0,696,683,1,0,0,0,696,684,1,0,0,0,697,698,1,0,0,
        0,698,699,5,123,0,0,699,703,3,184,92,0,700,701,5,83,0,0,701,702,
        5,69,0,0,702,704,5,148,0,0,703,700,1,0,0,0,703,704,1,0,0,0,704,707,
        1,0,0,0,705,706,5,174,0,0,706,708,3,62,31,0,707,705,1,0,0,0,707,
        708,1,0,0,0,708,709,1,0,0,0,709,718,5,41,0,0,710,715,3,130,65,0,
        711,715,3,100,50,0,712,715,3,56,28,0,713,715,3,112,56,0,714,710,
        1,0,0,0,714,711,1,0,0,0,714,712,1,0,0,0,714,713,1,0,0,0,715,716,
        1,0,0,0,716,717,5,1,0,0,717,719,1,0,0,0,718,714,1,0,0,0,719,720,
        1,0,0,0,720,718,1,0,0,0,720,721,1,0,0,0,721,722,1,0,0,0,722,723,
        5,71,0,0,723,45,1,0,0,0,724,726,5,53,0,0,725,727,7,2,0,0,726,725,
        1,0,0,0,726,727,1,0,0,0,727,728,1,0,0,0,728,732,5,172,0,0,729,730,
        5,92,0,0,730,731,5,116,0,0,731,733,5,76,0,0,732,729,1,0,0,0,732,
        733,1,0,0,0,733,737,1,0,0,0,734,735,3,182,91,0,735,736,5,2,0,0,736,
        738,1,0,0,0,737,734,1,0,0,0,737,738,1,0,0,0,738,739,1,0,0,0,739,
        751,3,202,101,0,740,741,5,3,0,0,741,746,3,188,94,0,742,743,5,5,0,
        0,743,745,3,188,94,0,744,742,1,0,0,0,745,748,1,0,0,0,746,744,1,0,
        0,0,746,747,1,0,0,0,747,749,1,0,0,0,748,746,1,0,0,0,749,750,5,4,
        0,0,750,752,1,0,0,0,751,740,1,0,0,0,751,752,1,0,0,0,752,753,1,0,
        0,0,753,754,5,36,0,0,754,755,3,112,56,0,755,47,1,0,0,0,756,757,5,
        53,0,0,757,758,5,173,0,0,758,762,5,156,0,0,759,760,5,92,0,0,760,
        761,5,116,0,0,761,763,5,76,0,0,762,759,1,0,0,0,762,763,1,0,0,0,763,
        767,1,0,0,0,764,765,3,182,91,0,765,766,5,2,0,0,766,768,1,0,0,0,767,
        764,1,0,0,0,767,768,1,0,0,0,768,769,1,0,0,0,769,770,3,184,92,0,770,
        771,5,169,0,0,771,783,3,204,102,0,772,773,5,3,0,0,773,778,3,166,
        83,0,774,775,5,5,0,0,775,777,3,166,83,0,776,774,1,0,0,0,777,780,
        1,0,0,0,778,776,1,0,0,0,778,779,1,0,0,0,779,781,1,0,0,0,780,778,
        1,0,0,0,781,782,5,4,0,0,782,784,1,0,0,0,783,772,1,0,0,0,783,784,
        1,0,0,0,784,49,1,0,0,0,785,787,5,177,0,0,786,788,5,137,0,0,787,786,
        1,0,0,0,787,788,1,0,0,0,788,789,1,0,0,0,789,794,3,52,26,0,790,791,
        5,5,0,0,791,793,3,52,26,0,792,790,1,0,0,0,793,796,1,0,0,0,794,792,
        1,0,0,0,794,795,1,0,0,0,795,51,1,0,0,0,796,794,1,0,0,0,797,798,3,
        54,27,0,798,803,5,36,0,0,799,801,5,116,0,0,800,799,1,0,0,0,800,801,
        1,0,0,0,801,802,1,0,0,0,802,804,5,113,0,0,803,800,1,0,0,0,803,804,
        1,0,0,0,804,805,1,0,0,0,805,806,5,3,0,0,806,807,3,112,56,0,807,808,
        5,4,0,0,808,53,1,0,0,0,809,821,3,184,92,0,810,811,5,3,0,0,811,816,
        3,188,94,0,812,813,5,5,0,0,813,815,3,188,94,0,814,812,1,0,0,0,815,
        818,1,0,0,0,816,814,1,0,0,0,816,817,1,0,0,0,817,819,1,0,0,0,818,
        816,1,0,0,0,819,820,5,4,0,0,820,822,1,0,0,0,821,810,1,0,0,0,821,
        822,1,0,0,0,822,55,1,0,0,0,823,825,3,50,25,0,824,823,1,0,0,0,824,
        825,1,0,0,0,825,826,1,0,0,0,826,827,5,63,0,0,827,828,5,85,0,0,828,
        831,3,134,67,0,829,830,5,175,0,0,830,832,3,62,31,0,831,829,1,0,0,
        0,831,832,1,0,0,0,832,834,1,0,0,0,833,835,3,102,51,0,834,833,1,0,
        0,0,834,835,1,0,0,0,835,837,1,0,0,0,836,838,3,148,74,0,837,836,1,
        0,0,0,837,838,1,0,0,0,838,840,1,0,0,0,839,841,3,150,75,0,840,839,
        1,0,0,0,840,841,1,0,0,0,841,57,1,0,0,0,842,844,5,65,0,0,843,845,
        5,59,0,0,844,843,1,0,0,0,844,845,1,0,0,0,845,846,1,0,0,0,846,847,
        3,182,91,0,847,59,1,0,0,0,848,849,5,68,0,0,849,852,7,9,0,0,850,851,
        5,92,0,0,851,853,5,76,0,0,852,850,1,0,0,0,852,853,1,0,0,0,853,857,
        1,0,0,0,854,855,3,182,91,0,855,856,5,2,0,0,856,858,1,0,0,0,857,854,
        1,0,0,0,857,858,1,0,0,0,858,859,1,0,0,0,859,860,3,228,114,0,860,
        61,1,0,0,0,861,862,3,64,32,0,862,63,1,0,0,0,863,868,3,66,33,0,864,
        865,5,124,0,0,865,867,3,66,33,0,866,864,1,0,0,0,867,870,1,0,0,0,
        868,866,1,0,0,0,868,869,1,0,0,0,869,65,1,0,0,0,870,868,1,0,0,0,871,
        876,3,68,34,0,872,873,5,35,0,0,873,875,3,68,34,0,874,872,1,0,0,0,
        875,878,1,0,0,0,876,874,1,0,0,0,876,877,1,0,0,0,877,67,1,0,0,0,878,
        876,1,0,0,0,879,881,5,116,0,0,880,879,1,0,0,0,881,884,1,0,0,0,882,
        880,1,0,0,0,882,883,1,0,0,0,883,885,1,0,0,0,884,882,1,0,0,0,885,
        886,3,70,35,0,886,69,1,0,0,0,887,970,3,72,36,0,888,889,7,10,0,0,
        889,969,3,72,36,0,890,892,5,104,0,0,891,893,5,116,0,0,892,891,1,
        0,0,0,892,893,1,0,0,0,893,896,1,0,0,0,894,895,5,66,0,0,895,897,5,
        85,0,0,896,894,1,0,0,0,896,897,1,0,0,0,897,898,1,0,0,0,898,969,3,
        72,36,0,899,901,5,116,0,0,900,899,1,0,0,0,900,901,1,0,0,0,901,902,
        1,0,0,0,902,903,5,42,0,0,903,904,3,72,36,0,904,905,5,35,0,0,905,
        906,3,72,36,0,906,969,1,0,0,0,907,909,5,116,0,0,908,907,1,0,0,0,
        908,909,1,0,0,0,909,910,1,0,0,0,910,949,5,95,0,0,911,921,5,3,0,0,
        912,922,3,112,56,0,913,918,3,72,36,0,914,915,5,5,0,0,915,917,3,72,
        36,0,916,914,1,0,0,0,917,920,1,0,0,0,918,916,1,0,0,0,918,919,1,0,
        0,0,919,922,1,0,0,0,920,918,1,0,0,0,921,912,1,0,0,0,921,913,1,0,
        0,0,921,922,1,0,0,0,922,923,1,0,0,0,923,950,5,4,0,0,924,925,3,182,
        91,0,925,926,5,2,0,0,926,928,1,0,0,0,927,924,1,0,0,0,927,928,1,0,
        0,0,928,929,1,0,0,0,929,950,3,184,92,0,930,931,3,182,91,0,931,932,
        5,2,0,0,932,934,1,0,0,0,933,930,1,0,0,0,933,934,1,0,0,0,934,935,
        1,0,0,0,935,936,3,220,110,0,936,945,5,3,0,0,937,942,3,72,36,0,938,
        939,5,5,0,0,939,941,3,72,36,0,940,938,1,0,0,0,941,944,1,0,0,0,942,
        940,1,0,0,0,942,943,1,0,0,0,943,946,1,0,0,0,944,942,1,0,0,0,945,
        937,1,0,0,0,945,946,1,0,0,0,946,947,1,0,0,0,947,948,5,4,0,0,948,
        950,1,0,0,0,949,911,1,0,0,0,949,927,1,0,0,0,949,933,1,0,0,0,950,
        969,1,0,0,0,951,953,5,116,0,0,952,951,1,0,0,0,952,953,1,0,0,0,953,
        962,1,0,0,0,954,955,5,110,0,0,955,958,3,72,36,0,956,957,5,72,0,0,
        957,959,3,72,36,0,958,956,1,0,0,0,958,959,1,0,0,0,959,963,1,0,0,
        0,960,961,7,11,0,0,961,963,3,72,36,0,962,954,1,0,0,0,962,960,1,0,
        0,0,963,969,1,0,0,0,964,969,5,105,0,0,965,969,5,118,0,0,966,967,
        5,116,0,0,967,969,5,119,0,0,968,888,1,0,0,0,968,890,1,0,0,0,968,
        900,1,0,0,0,968,908,1,0,0,0,968,952,1,0,0,0,968,964,1,0,0,0,968,
        965,1,0,0,0,968,966,1,0,0,0,969,972,1,0,0,0,970,968,1,0,0,0,970,
        971,1,0,0,0,971,71,1,0,0,0,972,970,1,0,0,0,973,978,3,74,37,0,974,
        975,7,12,0,0,975,977,3,74,37,0,976,974,1,0,0,0,977,980,1,0,0,0,978,
        976,1,0,0,0,978,979,1,0,0,0,979,73,1,0,0,0,980,978,1,0,0,0,981,986,
        3,76,38,0,982,983,7,13,0,0,983,985,3,76,38,0,984,982,1,0,0,0,985,
        988,1,0,0,0,986,984,1,0,0,0,986,987,1,0,0,0,987,75,1,0,0,0,988,986,
        1,0,0,0,989,994,3,78,39,0,990,991,7,4,0,0,991,993,3,78,39,0,992,
        990,1,0,0,0,993,996,1,0,0,0,994,992,1,0,0,0,994,995,1,0,0,0,995,
        77,1,0,0,0,996,994,1,0,0,0,997,1002,3,80,40,0,998,999,7,14,0,0,999,
        1001,3,80,40,0,1000,998,1,0,0,0,1001,1004,1,0,0,0,1002,1000,1,0,
        0,0,1002,1003,1,0,0,0,1003,79,1,0,0,0,1004,1002,1,0,0,0,1005,1010,
        3,82,41,0,1006,1007,7,15,0,0,1007,1009,3,82,41,0,1008,1006,1,0,0,
        0,1009,1012,1,0,0,0,1010,1008,1,0,0,0,1010,1011,1,0,0,0,1011,81,
        1,0,0,0,1012,1010,1,0,0,0,1013,1018,3,84,42,0,1014,1015,5,48,0,0,
        1015,1017,3,194,97,0,1016,1014,1,0,0,0,1017,1020,1,0,0,0,1018,1016,
        1,0,0,0,1018,1019,1,0,0,0,1019,83,1,0,0,0,1020,1018,1,0,0,0,1021,
        1023,7,16,0,0,1022,1021,1,0,0,0,1023,1026,1,0,0,0,1024,1022,1,0,
        0,0,1024,1025,1,0,0,0,1025,1027,1,0,0,0,1026,1024,1,0,0,0,1027,1028,
        3,86,43,0,1028,85,1,0,0,0,1029,1054,3,92,46,0,1030,1054,5,182,0,
        0,1031,1032,3,182,91,0,1032,1033,5,2,0,0,1033,1035,1,0,0,0,1034,
        1031,1,0,0,0,1034,1035,1,0,0,0,1035,1036,1,0,0,0,1036,1037,3,184,
        92,0,1037,1038,5,2,0,0,1038,1039,3,188,94,0,1039,1054,1,0,0,0,1040,
        1054,3,190,95,0,1041,1043,5,116,0,0,1042,1041,1,0,0,0,1042,1043,
        1,0,0,0,1043,1044,1,0,0,0,1044,1046,5,76,0,0,1045,1042,1,0,0,0,1045,
        1046,1,0,0,0,1046,1047,1,0,0,0,1047,1048,5,3,0,0,1048,1049,3,112,
        56,0,1049,1050,5,4,0,0,1050,1054,1,0,0,0,1051,1054,3,90,45,0,1052,
        1054,3,88,44,0,1053,1029,1,0,0,0,1053,1030,1,0,0,0,1053,1034,1,0,
        0,0,1053,1040,1,0,0,0,1053,1045,1,0,0,0,1053,1051,1,0,0,0,1053,1052,
        1,0,0,0,1054,87,1,0,0,0,1055,1056,3,180,90,0,1056,1072,5,3,0,0,1057,
        1059,5,66,0,0,1058,1057,1,0,0,0,1058,1059,1,0,0,0,1059,1060,1,0,
        0,0,1060,1065,3,62,31,0,1061,1062,5,5,0,0,1062,1064,3,62,31,0,1063,
        1061,1,0,0,0,1064,1067,1,0,0,0,1065,1063,1,0,0,0,1065,1066,1,0,0,
        0,1066,1069,1,0,0,0,1067,1065,1,0,0,0,1068,1070,3,148,74,0,1069,
        1068,1,0,0,0,1069,1070,1,0,0,0,1070,1073,1,0,0,0,1071,1073,5,7,0,
        0,1072,1058,1,0,0,0,1072,1071,1,0,0,0,1072,1073,1,0,0,0,1073,1074,
        1,0,0,0,1074,1076,5,4,0,0,1075,1077,3,94,47,0,1076,1075,1,0,0,0,
        1076,1077,1,0,0,0,1077,1079,1,0,0,0,1078,1080,3,138,69,0,1079,1078,
        1,0,0,0,1079,1080,1,0,0,0,1080,1082,1,0,0,0,1081,1083,3,142,71,0,
        1082,1081,1,0,0,0,1082,1083,1,0,0,0,1083,1122,1,0,0,0,1084,1085,
        5,3,0,0,1085,1090,3,62,31,0,1086,1087,5,5,0,0,1087,1089,3,62,31,
        0,1088,1086,1,0,0,0,1089,1092,1,0,0,0,1090,1088,1,0,0,0,1090,1091,
        1,0,0,0,1091,1093,1,0,0,0,1092,1090,1,0,0,0,1093,1094,5,4,0,0,1094,
        1122,1,0,0,0,1095,1096,5,46,0,0,1096,1097,5,3,0,0,1097,1098,3,62,
        31,0,1098,1099,5,36,0,0,1099,1100,3,32,16,0,1100,1101,5,4,0,0,1101,
        1122,1,0,0,0,1102,1104,5,45,0,0,1103,1105,3,62,31,0,1104,1103,1,
        0,0,0,1104,1105,1,0,0,0,1105,1111,1,0,0,0,1106,1107,5,174,0,0,1107,
        1108,3,62,31,0,1108,1109,5,159,0,0,1109,1110,3,62,31,0,1110,1112,
        1,0,0,0,1111,1106,1,0,0,0,1112,1113,1,0,0,0,1113,1111,1,0,0,0,1113,
        1114,1,0,0,0,1114,1117,1,0,0,0,1115,1116,5,70,0,0,1116,1118,3,62,
        31,0,1117,1115,1,0,0,0,1117,1118,1,0,0,0,1118,1119,1,0,0,0,1119,
        1120,5,71,0,0,1120,1122,1,0,0,0,1121,1055,1,0,0,0,1121,1084,1,0,
        0,0,1121,1095,1,0,0,0,1121,1102,1,0,0,0,1122,89,1,0,0,0,1123,1124,
        5,135,0,0,1124,1129,5,3,0,0,1125,1130,5,93,0,0,1126,1127,7,17,0,
        0,1127,1128,5,5,0,0,1128,1130,3,162,81,0,1129,1125,1,0,0,0,1129,
        1126,1,0,0,0,1130,1131,1,0,0,0,1131,1132,5,4,0,0,1132,91,1,0,0,0,
        1133,1134,7,18,0,0,1134,93,1,0,0,0,1135,1136,5,178,0,0,1136,1137,
        5,89,0,0,1137,1138,5,3,0,0,1138,1139,5,125,0,0,1139,1140,5,43,0,
        0,1140,1141,3,62,31,0,1141,1142,5,4,0,0,1142,95,1,0,0,0,1143,1144,
        5,3,0,0,1144,1149,3,62,31,0,1145,1146,5,5,0,0,1146,1148,3,62,31,
        0,1147,1145,1,0,0,0,1148,1151,1,0,0,0,1149,1147,1,0,0,0,1149,1150,
        1,0,0,0,1150,1152,1,0,0,0,1151,1149,1,0,0,0,1152,1153,5,4,0,0,1153,
        97,1,0,0,0,1154,1155,5,171,0,0,1155,1160,3,96,48,0,1156,1157,5,5,
        0,0,1157,1159,3,96,48,0,1158,1156,1,0,0,0,1159,1162,1,0,0,0,1160,
        1158,1,0,0,0,1160,1161,1,0,0,0,1161,99,1,0,0,0,1162,1160,1,0,0,0,
        1163,1165,3,50,25,0,1164,1163,1,0,0,0,1164,1165,1,0,0,0,1165,1171,
        1,0,0,0,1166,1172,5,100,0,0,1167,1172,5,143,0,0,1168,1169,5,100,
        0,0,1169,1170,5,124,0,0,1170,1172,7,8,0,0,1171,1166,1,0,0,0,1171,
        1167,1,0,0,0,1171,1168,1,0,0,0,1172,1173,1,0,0,0,1173,1177,5,103,
        0,0,1174,1175,3,182,91,0,1175,1176,5,2,0,0,1176,1178,1,0,0,0,1177,
        1174,1,0,0,0,1177,1178,1,0,0,0,1178,1179,1,0,0,0,1179,1182,3,184,
        92,0,1180,1181,5,36,0,0,1181,1183,3,210,105,0,1182,1180,1,0,0,0,
        1182,1183,1,0,0,0,1183,1195,1,0,0,0,1184,1185,5,3,0,0,1185,1190,
        3,188,94,0,1186,1187,5,5,0,0,1187,1189,3,188,94,0,1188,1186,1,0,
        0,0,1189,1192,1,0,0,0,1190,1188,1,0,0,0,1190,1191,1,0,0,0,1191,1193,
        1,0,0,0,1192,1190,1,0,0,0,1193,1194,5,4,0,0,1194,1196,1,0,0,0,1195,
        1184,1,0,0,0,1195,1196,1,0,0,0,1196,1206,1,0,0,0,1197,1201,3,112,
        56,0,1198,1200,3,104,52,0,1199,1198,1,0,0,0,1200,1203,1,0,0,0,1201,
        1199,1,0,0,0,1201,1202,1,0,0,0,1202,1207,1,0,0,0,1203,1201,1,0,0,
        0,1204,1205,5,60,0,0,1205,1207,5,171,0,0,1206,1197,1,0,0,0,1206,
        1204,1,0,0,0,1207,1209,1,0,0,0,1208,1210,3,102,51,0,1209,1208,1,
        0,0,0,1209,1210,1,0,0,0,1210,101,1,0,0,0,1211,1220,5,145,0,0,1212,
        1221,5,7,0,0,1213,1218,3,62,31,0,1214,1216,5,36,0,0,1215,1214,1,
        0,0,0,1215,1216,1,0,0,0,1216,1217,1,0,0,0,1217,1219,3,192,96,0,1218,
        1215,1,0,0,0,1218,1219,1,0,0,0,1219,1221,1,0,0,0,1220,1212,1,0,0,
        0,1220,1213,1,0,0,0,1221,1235,1,0,0,0,1222,1231,5,5,0,0,1223,1232,
        5,7,0,0,1224,1229,3,62,31,0,1225,1227,5,36,0,0,1226,1225,1,0,0,0,
        1226,1227,1,0,0,0,1227,1228,1,0,0,0,1228,1230,3,192,96,0,1229,1226,
        1,0,0,0,1229,1230,1,0,0,0,1230,1232,1,0,0,0,1231,1223,1,0,0,0,1231,
        1224,1,0,0,0,1232,1234,1,0,0,0,1233,1222,1,0,0,0,1234,1237,1,0,0,
        0,1235,1233,1,0,0,0,1235,1236,1,0,0,0,1236,103,1,0,0,0,1237,1235,
        1,0,0,0,1238,1239,5,123,0,0,1239,1254,5,51,0,0,1240,1241,5,3,0,0,
        1241,1246,3,24,12,0,1242,1243,5,5,0,0,1243,1245,3,24,12,0,1244,1242,
        1,0,0,0,1245,1248,1,0,0,0,1246,1244,1,0,0,0,1246,1247,1,0,0,0,1247,
        1249,1,0,0,0,1248,1246,1,0,0,0,1249,1252,5,4,0,0,1250,1251,5,175,
        0,0,1251,1253,3,62,31,0,1252,1250,1,0,0,0,1252,1253,1,0,0,0,1253,
        1255,1,0,0,0,1254,1240,1,0,0,0,1254,1255,1,0,0,0,1255,1256,1,0,0,
        0,1256,1283,5,67,0,0,1257,1284,5,117,0,0,1258,1259,5,168,0,0,1259,
        1262,5,153,0,0,1260,1263,3,188,94,0,1261,1263,3,132,66,0,1262,1260,
        1,0,0,0,1262,1261,1,0,0,0,1263,1264,1,0,0,0,1264,1265,5,6,0,0,1265,
        1276,3,62,31,0,1266,1269,5,5,0,0,1267,1270,3,188,94,0,1268,1270,
        3,132,66,0,1269,1267,1,0,0,0,1269,1268,1,0,0,0,1270,1271,1,0,0,0,
        1271,1272,5,6,0,0,1272,1273,3,62,31,0,1273,1275,1,0,0,0,1274,1266,
        1,0,0,0,1275,1278,1,0,0,0,1276,1274,1,0,0,0,1276,1277,1,0,0,0,1277,
        1281,1,0,0,0,1278,1276,1,0,0,0,1279,1280,5,175,0,0,1280,1282,3,62,
        31,0,1281,1279,1,0,0,0,1281,1282,1,0,0,0,1282,1284,1,0,0,0,1283,
        1257,1,0,0,0,1283,1258,1,0,0,0,1284,105,1,0,0,0,1285,1289,5,131,
        0,0,1286,1287,3,182,91,0,1287,1288,5,2,0,0,1288,1290,1,0,0,0,1289,
        1286,1,0,0,0,1289,1290,1,0,0,0,1290,1291,1,0,0,0,1291,1298,3,206,
        103,0,1292,1293,5,6,0,0,1293,1299,3,108,54,0,1294,1295,5,3,0,0,1295,
        1296,3,108,54,0,1296,1297,5,4,0,0,1297,1299,1,0,0,0,1298,1292,1,
        0,0,0,1298,1294,1,0,0,0,1298,1299,1,0,0,0,1299,107,1,0,0,0,1300,
        1304,3,36,18,0,1301,1304,3,178,89,0,1302,1304,5,183,0,0,1303,1300,
        1,0,0,0,1303,1301,1,0,0,0,1303,1302,1,0,0,0,1304,109,1,0,0,0,1305,
        1316,5,140,0,0,1306,1317,3,194,97,0,1307,1308,3,182,91,0,1308,1309,
        5,2,0,0,1309,1311,1,0,0,0,1310,1307,1,0,0,0,1310,1311,1,0,0,0,1311,
        1314,1,0,0,0,1312,1315,3,184,92,0,1313,1315,3,198,99,0,1314,1312,
        1,0,0,0,1314,1313,1,0,0,0,1315,1317,1,0,0,0,1316,1306,1,0,0,0,1316,
        1310,1,0,0,0,1316,1317,1,0,0,0,1317,111,1,0,0,0,1318,1320,3,50,25,
        0,1319,1318,1,0,0,0,1319,1320,1,0,0,0,1320,1321,1,0,0,0,1321,1327,
        3,118,59,0,1322,1323,3,128,64,0,1323,1324,3,118,59,0,1324,1326,1,
        0,0,0,1325,1322,1,0,0,0,1326,1329,1,0,0,0,1327,1325,1,0,0,0,1327,
        1328,1,0,0,0,1328,1331,1,0,0,0,1329,1327,1,0,0,0,1330,1332,3,148,
        74,0,1331,1330,1,0,0,0,1331,1332,1,0,0,0,1332,1334,1,0,0,0,1333,
        1335,3,150,75,0,1334,1333,1,0,0,0,1334,1335,1,0,0,0,1335,113,1,0,
        0,0,1336,1340,3,120,60,0,1337,1339,3,116,58,0,1338,1337,1,0,0,0,
        1339,1342,1,0,0,0,1340,1338,1,0,0,0,1340,1341,1,0,0,0,1341,115,1,
        0,0,0,1342,1340,1,0,0,0,1343,1344,3,124,62,0,1344,1346,3,120,60,
        0,1345,1347,3,126,63,0,1346,1345,1,0,0,0,1346,1347,1,0,0,0,1347,
        117,1,0,0,0,1348,1350,5,152,0,0,1349,1351,7,19,0,0,1350,1349,1,0,
        0,0,1350,1351,1,0,0,0,1351,1352,1,0,0,0,1352,1357,3,122,61,0,1353,
        1354,5,5,0,0,1354,1356,3,122,61,0,1355,1353,1,0,0,0,1356,1359,1,
        0,0,0,1357,1355,1,0,0,0,1357,1358,1,0,0,0,1358,1362,1,0,0,0,1359,
        1357,1,0,0,0,1360,1361,5,85,0,0,1361,1363,3,114,57,0,1362,1360,1,
        0,0,0,1362,1363,1,0,0,0,1363,1366,1,0,0,0,1364,1365,5,175,0,0,1365,
        1367,3,62,31,0,1366,1364,1,0,0,0,1366,1367,1,0,0,0,1367,1382,1,0,
        0,0,1368,1369,5,89,0,0,1369,1370,5,43,0,0,1370,1375,3,62,31,0,1371,
        1372,5,5,0,0,1372,1374,3,62,31,0,1373,1371,1,0,0,0,1374,1377,1,0,
        0,0,1375,1373,1,0,0,0,1375,1376,1,0,0,0,1376,1380,1,0,0,0,1377,1375,
        1,0,0,0,1378,1379,5,91,0,0,1379,1381,3,62,31,0,1380,1378,1,0,0,0,
        1380,1381,1,0,0,0,1381,1383,1,0,0,0,1382,1368,1,0,0,0,1382,1383,
        1,0,0,0,1383,1398,1,0,0,0,1384,1385,5,176,0,0,1385,1386,3,214,107,
        0,1386,1387,5,36,0,0,1387,1395,3,140,70,0,1388,1389,5,5,0,0,1389,
        1390,3,214,107,0,1390,1391,5,36,0,0,1391,1392,3,140,70,0,1392,1394,
        1,0,0,0,1393,1388,1,0,0,0,1394,1397,1,0,0,0,1395,1393,1,0,0,0,1395,
        1396,1,0,0,0,1396,1399,1,0,0,0,1397,1395,1,0,0,0,1398,1384,1,0,0,
        0,1398,1399,1,0,0,0,1399,1402,1,0,0,0,1400,1402,3,98,49,0,1401,1348,
        1,0,0,0,1401,1400,1,0,0,0,1402,119,1,0,0,0,1403,1404,3,182,91,0,
        1404,1405,5,2,0,0,1405,1407,1,0,0,0,1406,1403,1,0,0,0,1406,1407,
        1,0,0,0,1407,1408,1,0,0,0,1408,1412,3,184,92,0,1409,1410,5,36,0,
        0,1410,1413,3,210,105,0,1411,1413,3,212,106,0,1412,1409,1,0,0,0,
        1412,1411,1,0,0,0,1412,1413,1,0,0,0,1413,1419,1,0,0,0,1414,1415,
        5,97,0,0,1415,1416,5,43,0,0,1416,1420,3,198,99,0,1417,1418,5,116,
        0,0,1418,1420,5,97,0,0,1419,1414,1,0,0,0,1419,1417,1,0,0,0,1419,
        1420,1,0,0,0,1420,1457,1,0,0,0,1421,1422,3,182,91,0,1422,1423,5,
        2,0,0,1423,1425,1,0,0,0,1424,1421,1,0,0,0,1424,1425,1,0,0,0,1425,
        1426,1,0,0,0,1426,1427,3,220,110,0,1427,1428,5,3,0,0,1428,1433,3,
        62,31,0,1429,1430,5,5,0,0,1430,1432,3,62,31,0,1431,1429,1,0,0,0,
        1432,1435,1,0,0,0,1433,1431,1,0,0,0,1433,1434,1,0,0,0,1434,1436,
        1,0,0,0,1435,1433,1,0,0,0,1436,1441,5,4,0,0,1437,1439,5,36,0,0,1438,
        1437,1,0,0,0,1438,1439,1,0,0,0,1439,1440,1,0,0,0,1440,1442,3,210,
        105,0,1441,1438,1,0,0,0,1441,1442,1,0,0,0,1442,1457,1,0,0,0,1443,
        1444,5,3,0,0,1444,1445,3,114,57,0,1445,1446,5,4,0,0,1446,1457,1,
        0,0,0,1447,1448,5,3,0,0,1448,1449,3,112,56,0,1449,1454,5,4,0,0,1450,
        1452,5,36,0,0,1451,1450,1,0,0,0,1451,1452,1,0,0,0,1452,1453,1,0,
        0,0,1453,1455,3,210,105,0,1454,1451,1,0,0,0,1454,1455,1,0,0,0,1455,
        1457,1,0,0,0,1456,1406,1,0,0,0,1456,1424,1,0,0,0,1456,1443,1,0,0,
        0,1456,1447,1,0,0,0,1457,121,1,0,0,0,1458,1471,5,7,0,0,1459,1460,
        3,184,92,0,1460,1461,5,2,0,0,1461,1462,5,7,0,0,1462,1471,1,0,0,0,
        1463,1468,3,62,31,0,1464,1466,5,36,0,0,1465,1464,1,0,0,0,1465,1466,
        1,0,0,0,1466,1467,1,0,0,0,1467,1469,3,192,96,0,1468,1465,1,0,0,0,
        1468,1469,1,0,0,0,1469,1471,1,0,0,0,1470,1458,1,0,0,0,1470,1459,
        1,0,0,0,1470,1463,1,0,0,0,1471,123,1,0,0,0,1472,1486,5,5,0,0,1473,
        1475,5,114,0,0,1474,1473,1,0,0,0,1474,1475,1,0,0,0,1475,1482,1,0,
        0,0,1476,1478,7,20,0,0,1477,1479,5,127,0,0,1478,1477,1,0,0,0,1478,
        1479,1,0,0,0,1479,1483,1,0,0,0,1480,1483,5,99,0,0,1481,1483,5,54,
        0,0,1482,1476,1,0,0,0,1482,1480,1,0,0,0,1482,1481,1,0,0,0,1482,1483,
        1,0,0,0,1483,1484,1,0,0,0,1484,1486,5,106,0,0,1485,1472,1,0,0,0,
        1485,1474,1,0,0,0,1486,125,1,0,0,0,1487,1488,5,123,0,0,1488,1502,
        3,62,31,0,1489,1490,5,169,0,0,1490,1491,5,3,0,0,1491,1496,3,188,
        94,0,1492,1493,5,5,0,0,1493,1495,3,188,94,0,1494,1492,1,0,0,0,1495,
        1498,1,0,0,0,1496,1494,1,0,0,0,1496,1497,1,0,0,0,1497,1499,1,0,0,
        0,1498,1496,1,0,0,0,1499,1500,5,4,0,0,1500,1502,1,0,0,0,1501,1487,
        1,0,0,0,1501,1489,1,0,0,0,1502,127,1,0,0,0,1503,1505,5,166,0,0,1504,
        1506,5,31,0,0,1505,1504,1,0,0,0,1505,1506,1,0,0,0,1506,1510,1,0,
        0,0,1507,1510,5,102,0,0,1508,1510,5,73,0,0,1509,1503,1,0,0,0,1509,
        1507,1,0,0,0,1509,1508,1,0,0,0,1510,129,1,0,0,0,1511,1513,3,50,25,
        0,1512,1511,1,0,0,0,1512,1513,1,0,0,0,1513,1514,1,0,0,0,1514,1517,
        5,168,0,0,1515,1516,5,124,0,0,1516,1518,7,8,0,0,1517,1515,1,0,0,
        0,1517,1518,1,0,0,0,1518,1519,1,0,0,0,1519,1520,3,134,67,0,1520,
        1523,5,153,0,0,1521,1524,3,188,94,0,1522,1524,3,132,66,0,1523,1521,
        1,0,0,0,1523,1522,1,0,0,0,1524,1525,1,0,0,0,1525,1526,5,6,0,0,1526,
        1537,3,62,31,0,1527,1530,5,5,0,0,1528,1531,3,188,94,0,1529,1531,
        3,132,66,0,1530,1528,1,0,0,0,1530,1529,1,0,0,0,1531,1532,1,0,0,0,
        1532,1533,5,6,0,0,1533,1534,3,62,31,0,1534,1536,1,0,0,0,1535,1527,
        1,0,0,0,1536,1539,1,0,0,0,1537,1535,1,0,0,0,1537,1538,1,0,0,0,1538,
        1542,1,0,0,0,1539,1537,1,0,0,0,1540,1541,5,85,0,0,1541,1543,3,114,
        57,0,1542,1540,1,0,0,0,1542,1543,1,0,0,0,1543,1546,1,0,0,0,1544,
        1545,5,175,0,0,1545,1547,3,62,31,0,1546,1544,1,0,0,0,1546,1547,1,
        0,0,0,1547,1549,1,0,0,0,1548,1550,3,102,51,0,1549,1548,1,0,0,0,1549,
        1550,1,0,0,0,1550,1552,1,0,0,0,1551,1553,3,148,74,0,1552,1551,1,
        0,0,0,1552,1553,1,0,0,0,1553,1555,1,0,0,0,1554,1556,3,150,75,0,1555,
        1554,1,0,0,0,1555,1556,1,0,0,0,1556,131,1,0,0,0,1557,1558,5,3,0,
        0,1558,1563,3,188,94,0,1559,1560,5,5,0,0,1560,1562,3,188,94,0,1561,
        1559,1,0,0,0,1562,1565,1,0,0,0,1563,1561,1,0,0,0,1563,1564,1,0,0,
        0,1564,1566,1,0,0,0,1565,1563,1,0,0,0,1566,1567,5,4,0,0,1567,133,
        1,0,0,0,1568,1569,3,182,91,0,1569,1570,5,2,0,0,1570,1572,1,0,0,0,
        1571,1568,1,0,0,0,1571,1572,1,0,0,0,1572,1573,1,0,0,0,1573,1576,
        3,184,92,0,1574,1575,5,36,0,0,1575,1577,3,216,108,0,1576,1574,1,
        0,0,0,1576,1577,1,0,0,0,1577,1583,1,0,0,0,1578,1579,5,97,0,0,1579,
        1580,5,43,0,0,1580,1584,3,198,99,0,1581,1582,5,116,0,0,1582,1584,
        5,97,0,0,1583,1578,1,0,0,0,1583,1581,1,0,0,0,1583,1584,1,0,0,0,1584,
        135,1,0,0,0,1585,1587,5,170,0,0,1586,1588,3,182,91,0,1587,1586,1,
        0,0,0,1587,1588,1,0,0,0,1588,1591,1,0,0,0,1589,1590,5,103,0,0,1590,
        1592,3,164,82,0,1591,1589,1,0,0,0,1591,1592,1,0,0,0,1592,137,1,0,
        0,0,1593,1594,5,80,0,0,1594,1595,5,3,0,0,1595,1596,5,175,0,0,1596,
        1597,3,62,31,0,1597,1598,5,4,0,0,1598,139,1,0,0,0,1599,1601,5,3,
        0,0,1600,1602,3,218,109,0,1601,1600,1,0,0,0,1601,1602,1,0,0,0,1602,
        1613,1,0,0,0,1603,1604,5,129,0,0,1604,1605,5,43,0,0,1605,1610,3,
        62,31,0,1606,1607,5,5,0,0,1607,1609,3,62,31,0,1608,1606,1,0,0,0,
        1609,1612,1,0,0,0,1610,1608,1,0,0,0,1610,1611,1,0,0,0,1611,1614,
        1,0,0,0,1612,1610,1,0,0,0,1613,1603,1,0,0,0,1613,1614,1,0,0,0,1614,
        1616,1,0,0,0,1615,1617,3,148,74,0,1616,1615,1,0,0,0,1616,1617,1,
        0,0,0,1617,1619,1,0,0,0,1618,1620,3,144,72,0,1619,1618,1,0,0,0,1619,
        1620,1,0,0,0,1620,1621,1,0,0,0,1621,1622,5,4,0,0,1622,141,1,0,0,
        0,1623,1648,5,128,0,0,1624,1649,3,214,107,0,1625,1627,5,3,0,0,1626,
        1628,3,218,109,0,1627,1626,1,0,0,0,1627,1628,1,0,0,0,1628,1639,1,
        0,0,0,1629,1630,5,129,0,0,1630,1631,5,43,0,0,1631,1636,3,62,31,0,
        1632,1633,5,5,0,0,1633,1635,3,62,31,0,1634,1632,1,0,0,0,1635,1638,
        1,0,0,0,1636,1634,1,0,0,0,1636,1637,1,0,0,0,1637,1640,1,0,0,0,1638,
        1636,1,0,0,0,1639,1629,1,0,0,0,1639,1640,1,0,0,0,1640,1642,1,0,0,
        0,1641,1643,3,148,74,0,1642,1641,1,0,0,0,1642,1643,1,0,0,0,1643,
        1645,1,0,0,0,1644,1646,3,144,72,0,1645,1644,1,0,0,0,1645,1646,1,
        0,0,0,1646,1647,1,0,0,0,1647,1649,5,4,0,0,1648,1624,1,0,0,0,1648,
        1625,1,0,0,0,1649,143,1,0,0,0,1650,1660,3,146,73,0,1651,1658,5,74,
        0,0,1652,1653,5,115,0,0,1653,1659,5,126,0,0,1654,1655,5,55,0,0,1655,
        1659,5,148,0,0,1656,1659,5,89,0,0,1657,1659,5,160,0,0,1658,1652,
        1,0,0,0,1658,1654,1,0,0,0,1658,1656,1,0,0,0,1658,1657,1,0,0,0,1659,
        1661,1,0,0,0,1660,1651,1,0,0,0,1660,1661,1,0,0,0,1661,145,1,0,0,
        0,1662,1669,7,21,0,0,1663,1670,3,160,80,0,1664,1665,5,42,0,0,1665,
        1666,3,156,78,0,1666,1667,5,35,0,0,1667,1668,3,158,79,0,1668,1670,
        1,0,0,0,1669,1663,1,0,0,0,1669,1664,1,0,0,0,1670,147,1,0,0,0,1671,
        1672,5,125,0,0,1672,1673,5,43,0,0,1673,1678,3,152,76,0,1674,1675,
        5,5,0,0,1675,1677,3,152,76,0,1676,1674,1,0,0,0,1677,1680,1,0,0,0,
        1678,1676,1,0,0,0,1678,1679,1,0,0,0,1679,149,1,0,0,0,1680,1678,1,
        0,0,0,1681,1682,5,111,0,0,1682,1685,3,62,31,0,1683,1684,7,22,0,0,
        1684,1686,3,62,31,0,1685,1683,1,0,0,0,1685,1686,1,0,0,0,1686,151,
        1,0,0,0,1687,1690,3,62,31,0,1688,1689,5,48,0,0,1689,1691,3,194,97,
        0,1690,1688,1,0,0,0,1690,1691,1,0,0,0,1691,1693,1,0,0,0,1692,1694,
        3,154,77,0,1693,1692,1,0,0,0,1693,1694,1,0,0,0,1694,1697,1,0,0,0,
        1695,1696,5,120,0,0,1696,1698,7,23,0,0,1697,1695,1,0,0,0,1697,1698,
        1,0,0,0,1698,153,1,0,0,0,1699,1700,7,24,0,0,1700,155,1,0,0,0,1701,
        1702,3,62,31,0,1702,1703,5,132,0,0,1703,1710,1,0,0,0,1704,1705,3,
        62,31,0,1705,1706,5,82,0,0,1706,1710,1,0,0,0,1707,1708,5,55,0,0,
        1708,1710,5,148,0,0,1709,1701,1,0,0,0,1709,1704,1,0,0,0,1709,1707,
        1,0,0,0,1710,157,1,0,0,0,1711,1712,3,62,31,0,1712,1713,5,132,0,0,
        1713,1720,1,0,0,0,1714,1715,3,62,31,0,1715,1716,5,82,0,0,1716,1720,
        1,0,0,0,1717,1718,5,55,0,0,1718,1720,5,148,0,0,1719,1711,1,0,0,0,
        1719,1714,1,0,0,0,1719,1717,1,0,0,0,1720,159,1,0,0,0,1721,1722,3,
        62,31,0,1722,1723,5,132,0,0,1723,1727,1,0,0,0,1724,1725,5,55,0,0,
        1725,1727,5,148,0,0,1726,1721,1,0,0,0,1726,1724,1,0,0,0,1727,161,
        1,0,0,0,1728,1729,3,62,31,0,1729,163,1,0,0,0,1730,1731,3,62,31,0,
        1731,165,1,0,0,0,1732,1734,3,168,84,0,1733,1732,1,0,0,0,1734,1737,
        1,0,0,0,1735,1733,1,0,0,0,1735,1736,1,0,0,0,1736,167,1,0,0,0,1737,
        1735,1,0,0,0,1738,1748,8,25,0,0,1739,1743,5,3,0,0,1740,1742,3,170,
        85,0,1741,1740,1,0,0,0,1742,1745,1,0,0,0,1743,1741,1,0,0,0,1743,
        1744,1,0,0,0,1744,1746,1,0,0,0,1745,1743,1,0,0,0,1746,1748,5,4,0,
        0,1747,1738,1,0,0,0,1747,1739,1,0,0,0,1748,169,1,0,0,0,1749,1759,
        8,26,0,0,1750,1754,5,3,0,0,1751,1753,3,170,85,0,1752,1751,1,0,0,
        0,1753,1756,1,0,0,0,1754,1752,1,0,0,0,1754,1755,1,0,0,0,1755,1757,
        1,0,0,0,1756,1754,1,0,0,0,1757,1759,5,4,0,0,1758,1749,1,0,0,0,1758,
        1750,1,0,0,0,1759,171,1,0,0,0,1760,1761,7,27,0,0,1761,173,1,0,0,
        0,1762,1763,7,28,0,0,1763,175,1,0,0,0,1764,1768,3,172,86,0,1765,
        1768,3,174,87,0,1766,1768,5,135,0,0,1767,1764,1,0,0,0,1767,1765,
        1,0,0,0,1767,1766,1,0,0,0,1768,177,1,0,0,0,1769,1770,3,228,114,0,
        1770,179,1,0,0,0,1771,1772,3,222,111,0,1772,181,1,0,0,0,1773,1774,
        3,228,114,0,1774,183,1,0,0,0,1775,1776,3,228,114,0,1776,185,1,0,
        0,0,1777,1778,3,228,114,0,1778,187,1,0,0,0,1779,1780,3,228,114,0,
        1780,189,1,0,0,0,1781,1782,3,226,113,0,1782,191,1,0,0,0,1783,1784,
        3,228,114,0,1784,193,1,0,0,0,1785,1786,3,228,114,0,1786,195,1,0,
        0,0,1787,1788,3,228,114,0,1788,197,1,0,0,0,1789,1790,3,228,114,0,
        1790,199,1,0,0,0,1791,1792,3,228,114,0,1792,201,1,0,0,0,1793,1794,
        3,228,114,0,1794,203,1,0,0,0,1795,1796,3,228,114,0,1796,205,1,0,
        0,0,1797,1798,3,228,114,0,1798,207,1,0,0,0,1799,1800,3,228,114,0,
        1800,209,1,0,0,0,1801,1802,3,228,114,0,1802,211,1,0,0,0,1803,1804,
        3,224,112,0,1804,213,1,0,0,0,1805,1806,3,228,114,0,1806,215,1,0,
        0,0,1807,1808,3,228,114,0,1808,217,1,0,0,0,1809,1810,3,228,114,0,
        1810,219,1,0,0,0,1811,1812,3,228,114,0,1812,221,1,0,0,0,1813,1818,
        5,180,0,0,1814,1818,3,172,86,0,1815,1818,3,174,87,0,1816,1818,5,
        183,0,0,1817,1813,1,0,0,0,1817,1814,1,0,0,0,1817,1815,1,0,0,0,1817,
        1816,1,0,0,0,1818,223,1,0,0,0,1819,1824,5,180,0,0,1820,1824,3,172,
        86,0,1821,1824,5,135,0,0,1822,1824,5,183,0,0,1823,1819,1,0,0,0,1823,
        1820,1,0,0,0,1823,1821,1,0,0,0,1823,1822,1,0,0,0,1824,225,1,0,0,
        0,1825,1828,5,180,0,0,1826,1828,3,176,88,0,1827,1825,1,0,0,0,1827,
        1826,1,0,0,0,1828,227,1,0,0,0,1829,1833,5,180,0,0,1830,1833,3,176,
        88,0,1831,1833,5,183,0,0,1832,1829,1,0,0,0,1832,1830,1,0,0,0,1832,
        1831,1,0,0,0,1833,229,1,0,0,0,270,234,238,242,248,250,274,281,288,
        294,298,303,308,310,314,319,323,330,335,337,344,347,351,359,362,
        366,370,374,377,384,390,396,401,412,418,423,426,430,436,441,450,
        457,462,466,471,477,481,486,491,497,509,513,518,521,524,527,531,
        534,548,555,562,564,567,573,578,586,591,606,612,622,627,637,641,
        643,647,652,654,662,668,673,680,691,694,696,703,707,714,720,726,
        732,737,746,751,762,767,778,783,787,794,800,803,816,821,824,831,
        834,837,840,844,852,857,868,876,882,892,896,900,908,918,921,927,
        933,942,945,949,952,958,962,968,970,978,986,994,1002,1010,1018,1024,
        1034,1042,1045,1053,1058,1065,1069,1072,1076,1079,1082,1090,1104,
        1113,1117,1121,1129,1149,1160,1164,1171,1177,1182,1190,1195,1201,
        1206,1209,1215,1218,1220,1226,1229,1231,1235,1246,1252,1254,1262,
        1269,1276,1281,1283,1289,1298,1303,1310,1314,1316,1319,1327,1331,
        1334,1340,1346,1350,1357,1362,1366,1375,1380,1382,1395,1398,1401,
        1406,1412,1419,1424,1433,1438,1441,1451,1454,1456,1465,1468,1470,
        1474,1478,1482,1485,1496,1501,1505,1509,1512,1517,1523,1530,1537,
        1542,1546,1549,1552,1555,1563,1571,1576,1583,1587,1591,1601,1610,
        1613,1616,1619,1627,1636,1639,1642,1645,1648,1658,1660,1669,1678,
        1685,1690,1693,1697,1709,1719,1726,1735,1743,1747,1754,1758,1767,
        1817,1823,1827,1832
    ];

    private static __ATN: antlr.ATN;
    public static get _ATN(): antlr.ATN {
        if (!SqliteParser.__ATN) {
            SqliteParser.__ATN = new antlr.ATNDeserializer().deserialize(SqliteParser._serializedATN);
        }

        return SqliteParser.__ATN;
    }


    private static readonly vocabulary = new antlr.Vocabulary(SqliteParser.literalNames, SqliteParser.symbolicNames, []);

    public override get vocabulary(): antlr.Vocabulary {
        return SqliteParser.vocabulary;
    }

    private static readonly decisionsToDFA = SqliteParser._ATN.decisionToState.map( (ds: antlr.DecisionState, index: number) => new antlr.DFA(ds, index) );
}

export class ParseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public sql_stmt_list(): Sql_stmt_listContext {
        return this.getRuleContext(0, Sql_stmt_listContext)!;
    }
    public EOF(): antlr.TerminalNode {
        return this.getToken(SqliteParser.EOF, 0)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_parse;
    }
}


export class Sql_stmt_listContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public sql_stmt(): Sql_stmtContext[];
    public sql_stmt(i: number): Sql_stmtContext | null;
    public sql_stmt(i?: number): Sql_stmtContext[] | Sql_stmtContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Sql_stmtContext);
        }

        return this.getRuleContext(i, Sql_stmtContext);
    }
    public SCOL(): antlr.TerminalNode[];
    public SCOL(i: number): antlr.TerminalNode | null;
    public SCOL(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.SCOL);
    	} else {
    		return this.getToken(SqliteParser.SCOL, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_sql_stmt_list;
    }
}


export class Sql_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public alter_table_stmt(): Alter_table_stmtContext | null {
        return this.getRuleContext(0, Alter_table_stmtContext);
    }
    public analyze_stmt(): Analyze_stmtContext | null {
        return this.getRuleContext(0, Analyze_stmtContext);
    }
    public attach_stmt(): Attach_stmtContext | null {
        return this.getRuleContext(0, Attach_stmtContext);
    }
    public begin_stmt(): Begin_stmtContext | null {
        return this.getRuleContext(0, Begin_stmtContext);
    }
    public commit_stmt(): Commit_stmtContext | null {
        return this.getRuleContext(0, Commit_stmtContext);
    }
    public create_index_stmt(): Create_index_stmtContext | null {
        return this.getRuleContext(0, Create_index_stmtContext);
    }
    public create_table_stmt(): Create_table_stmtContext | null {
        return this.getRuleContext(0, Create_table_stmtContext);
    }
    public create_trigger_stmt(): Create_trigger_stmtContext | null {
        return this.getRuleContext(0, Create_trigger_stmtContext);
    }
    public create_view_stmt(): Create_view_stmtContext | null {
        return this.getRuleContext(0, Create_view_stmtContext);
    }
    public create_virtual_table_stmt(): Create_virtual_table_stmtContext | null {
        return this.getRuleContext(0, Create_virtual_table_stmtContext);
    }
    public delete_stmt(): Delete_stmtContext | null {
        return this.getRuleContext(0, Delete_stmtContext);
    }
    public detach_stmt(): Detach_stmtContext | null {
        return this.getRuleContext(0, Detach_stmtContext);
    }
    public drop_stmt(): Drop_stmtContext | null {
        return this.getRuleContext(0, Drop_stmtContext);
    }
    public insert_stmt(): Insert_stmtContext | null {
        return this.getRuleContext(0, Insert_stmtContext);
    }
    public pragma_stmt(): Pragma_stmtContext | null {
        return this.getRuleContext(0, Pragma_stmtContext);
    }
    public reindex_stmt(): Reindex_stmtContext | null {
        return this.getRuleContext(0, Reindex_stmtContext);
    }
    public release_stmt(): Release_stmtContext | null {
        return this.getRuleContext(0, Release_stmtContext);
    }
    public rollback_stmt(): Rollback_stmtContext | null {
        return this.getRuleContext(0, Rollback_stmtContext);
    }
    public savepoint_stmt(): Savepoint_stmtContext | null {
        return this.getRuleContext(0, Savepoint_stmtContext);
    }
    public select_stmt(): Select_stmtContext | null {
        return this.getRuleContext(0, Select_stmtContext);
    }
    public update_stmt(): Update_stmtContext | null {
        return this.getRuleContext(0, Update_stmtContext);
    }
    public vacuum_stmt(): Vacuum_stmtContext | null {
        return this.getRuleContext(0, Vacuum_stmtContext);
    }
    public EXPLAIN_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.EXPLAIN_, 0);
    }
    public QUERY_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.QUERY_, 0);
    }
    public PLAN_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.PLAN_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_sql_stmt;
    }
}


export class Alter_table_stmtContext extends antlr.ParserRuleContext {
    public _new_table_name?: Table_nameContext;
    public _old_column_name?: Column_nameContext;
    public _new_column_name?: Column_nameContext;
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public ALTER_(): antlr.TerminalNode[];
    public ALTER_(i: number): antlr.TerminalNode | null;
    public ALTER_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.ALTER_);
    	} else {
    		return this.getToken(SqliteParser.ALTER_, i);
    	}
    }
    public TABLE_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.TABLE_, 0)!;
    }
    public table_name(): Table_nameContext[];
    public table_name(i: number): Table_nameContext | null;
    public table_name(i?: number): Table_nameContext[] | Table_nameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Table_nameContext);
        }

        return this.getRuleContext(i, Table_nameContext);
    }
    public RENAME_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.RENAME_, 0);
    }
    public ADD_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ADD_, 0);
    }
    public DROP_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DROP_, 0);
    }
    public column_name(): Column_nameContext[];
    public column_name(i: number): Column_nameContext | null;
    public column_name(i?: number): Column_nameContext[] | Column_nameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Column_nameContext);
        }

        return this.getRuleContext(i, Column_nameContext);
    }
    public schema_name(): Schema_nameContext | null {
        return this.getRuleContext(0, Schema_nameContext);
    }
    public DOT(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DOT, 0);
    }
    public TO_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.TO_, 0);
    }
    public column_def(): Column_defContext | null {
        return this.getRuleContext(0, Column_defContext);
    }
    public CHECK_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CHECK_, 0);
    }
    public CONSTRAINT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CONSTRAINT_, 0);
    }
    public name(): NameContext | null {
        return this.getRuleContext(0, NameContext);
    }
    public COLUMN_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.COLUMN_, 0);
    }
    public expr(): ExprContext | null {
        return this.getRuleContext(0, ExprContext);
    }
    public SET_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.SET_, 0);
    }
    public NOT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NOT_, 0);
    }
    public NULL_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NULL_, 0);
    }
    public conflict_clause(): Conflict_clauseContext | null {
        return this.getRuleContext(0, Conflict_clauseContext);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_alter_table_stmt;
    }
}


export class Analyze_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public ANALYZE_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.ANALYZE_, 0)!;
    }
    public schema_name(): Schema_nameContext | null {
        return this.getRuleContext(0, Schema_nameContext);
    }
    public table_or_index_name(): Table_or_index_nameContext | null {
        return this.getRuleContext(0, Table_or_index_nameContext);
    }
    public DOT(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DOT, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_analyze_stmt;
    }
}


export class Attach_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public ATTACH_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.ATTACH_, 0)!;
    }
    public expr(): ExprContext {
        return this.getRuleContext(0, ExprContext)!;
    }
    public AS_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.AS_, 0)!;
    }
    public schema_name(): Schema_nameContext {
        return this.getRuleContext(0, Schema_nameContext)!;
    }
    public DATABASE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DATABASE_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_attach_stmt;
    }
}


export class Begin_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public BEGIN_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.BEGIN_, 0)!;
    }
    public TRANSACTION_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.TRANSACTION_, 0);
    }
    public DEFERRED_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DEFERRED_, 0);
    }
    public IMMEDIATE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.IMMEDIATE_, 0);
    }
    public EXCLUSIVE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.EXCLUSIVE_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_begin_stmt;
    }
}


export class Commit_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public COMMIT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.COMMIT_, 0);
    }
    public END_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.END_, 0);
    }
    public TRANSACTION_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.TRANSACTION_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_commit_stmt;
    }
}


export class Rollback_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public ROLLBACK_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.ROLLBACK_, 0)!;
    }
    public TRANSACTION_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.TRANSACTION_, 0);
    }
    public TO_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.TO_, 0);
    }
    public savepoint_name(): Savepoint_nameContext | null {
        return this.getRuleContext(0, Savepoint_nameContext);
    }
    public SAVEPOINT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.SAVEPOINT_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_rollback_stmt;
    }
}


export class Savepoint_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public SAVEPOINT_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.SAVEPOINT_, 0)!;
    }
    public savepoint_name(): Savepoint_nameContext {
        return this.getRuleContext(0, Savepoint_nameContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_savepoint_stmt;
    }
}


export class Release_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public RELEASE_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.RELEASE_, 0)!;
    }
    public savepoint_name(): Savepoint_nameContext {
        return this.getRuleContext(0, Savepoint_nameContext)!;
    }
    public SAVEPOINT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.SAVEPOINT_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_release_stmt;
    }
}


export class Create_index_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public CREATE_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.CREATE_, 0)!;
    }
    public INDEX_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.INDEX_, 0)!;
    }
    public index_name(): Index_nameContext {
        return this.getRuleContext(0, Index_nameContext)!;
    }
    public ON_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.ON_, 0)!;
    }
    public table_name(): Table_nameContext {
        return this.getRuleContext(0, Table_nameContext)!;
    }
    public OPEN_PAR(): antlr.TerminalNode {
        return this.getToken(SqliteParser.OPEN_PAR, 0)!;
    }
    public indexed_column(): Indexed_columnContext[];
    public indexed_column(i: number): Indexed_columnContext | null;
    public indexed_column(i?: number): Indexed_columnContext[] | Indexed_columnContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Indexed_columnContext);
        }

        return this.getRuleContext(i, Indexed_columnContext);
    }
    public CLOSE_PAR(): antlr.TerminalNode {
        return this.getToken(SqliteParser.CLOSE_PAR, 0)!;
    }
    public UNIQUE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.UNIQUE_, 0);
    }
    public IF_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.IF_, 0);
    }
    public NOT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NOT_, 0);
    }
    public EXISTS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.EXISTS_, 0);
    }
    public schema_name(): Schema_nameContext | null {
        return this.getRuleContext(0, Schema_nameContext);
    }
    public DOT(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DOT, 0);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public WHERE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.WHERE_, 0);
    }
    public expr(): ExprContext | null {
        return this.getRuleContext(0, ExprContext);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_create_index_stmt;
    }
}


export class Indexed_columnContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr(): ExprContext {
        return this.getRuleContext(0, ExprContext)!;
    }
    public COLLATE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.COLLATE_, 0);
    }
    public collation_name(): Collation_nameContext | null {
        return this.getRuleContext(0, Collation_nameContext);
    }
    public asc_desc(): Asc_descContext | null {
        return this.getRuleContext(0, Asc_descContext);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_indexed_column;
    }
}


export class Create_table_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public CREATE_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.CREATE_, 0)!;
    }
    public TABLE_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.TABLE_, 0)!;
    }
    public table_name(): Table_nameContext {
        return this.getRuleContext(0, Table_nameContext)!;
    }
    public OPEN_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OPEN_PAR, 0);
    }
    public column_def(): Column_defContext[];
    public column_def(i: number): Column_defContext | null;
    public column_def(i?: number): Column_defContext[] | Column_defContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Column_defContext);
        }

        return this.getRuleContext(i, Column_defContext);
    }
    public CLOSE_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CLOSE_PAR, 0);
    }
    public AS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.AS_, 0);
    }
    public select_stmt(): Select_stmtContext | null {
        return this.getRuleContext(0, Select_stmtContext);
    }
    public IF_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.IF_, 0);
    }
    public NOT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NOT_, 0);
    }
    public EXISTS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.EXISTS_, 0);
    }
    public schema_name(): Schema_nameContext | null {
        return this.getRuleContext(0, Schema_nameContext);
    }
    public DOT(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DOT, 0);
    }
    public TEMP_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.TEMP_, 0);
    }
    public TEMPORARY_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.TEMPORARY_, 0);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public table_constraint(): Table_constraintContext[];
    public table_constraint(i: number): Table_constraintContext | null;
    public table_constraint(i?: number): Table_constraintContext[] | Table_constraintContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Table_constraintContext);
        }

        return this.getRuleContext(i, Table_constraintContext);
    }
    public table_options(): Table_optionsContext | null {
        return this.getRuleContext(0, Table_optionsContext);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_create_table_stmt;
    }
}


export class Table_optionsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public WITHOUT_(): antlr.TerminalNode[];
    public WITHOUT_(i: number): antlr.TerminalNode | null;
    public WITHOUT_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.WITHOUT_);
    	} else {
    		return this.getToken(SqliteParser.WITHOUT_, i);
    	}
    }
    public ROWID_(): antlr.TerminalNode[];
    public ROWID_(i: number): antlr.TerminalNode | null;
    public ROWID_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.ROWID_);
    	} else {
    		return this.getToken(SqliteParser.ROWID_, i);
    	}
    }
    public STRICT_(): antlr.TerminalNode[];
    public STRICT_(i: number): antlr.TerminalNode | null;
    public STRICT_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.STRICT_);
    	} else {
    		return this.getToken(SqliteParser.STRICT_, i);
    	}
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_table_options;
    }
}


export class Column_defContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public column_name(): Column_nameContext {
        return this.getRuleContext(0, Column_nameContext)!;
    }
    public type_name(): Type_nameContext | null {
        return this.getRuleContext(0, Type_nameContext);
    }
    public column_constraint(): Column_constraintContext[];
    public column_constraint(i: number): Column_constraintContext | null;
    public column_constraint(i?: number): Column_constraintContext[] | Column_constraintContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Column_constraintContext);
        }

        return this.getRuleContext(i, Column_constraintContext);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_column_def;
    }
}


export class Type_nameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public name(): NameContext[];
    public name(i: number): NameContext | null;
    public name(i?: number): NameContext[] | NameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(NameContext);
        }

        return this.getRuleContext(i, NameContext);
    }
    public OPEN_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OPEN_PAR, 0);
    }
    public signed_number(): Signed_numberContext[];
    public signed_number(i: number): Signed_numberContext | null;
    public signed_number(i?: number): Signed_numberContext[] | Signed_numberContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Signed_numberContext);
        }

        return this.getRuleContext(i, Signed_numberContext);
    }
    public CLOSE_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CLOSE_PAR, 0);
    }
    public COMMA(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.COMMA, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_type_name;
    }
}


export class Column_constraintContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public PRIMARY_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.PRIMARY_, 0);
    }
    public KEY_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.KEY_, 0);
    }
    public CHECK_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CHECK_, 0);
    }
    public OPEN_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OPEN_PAR, 0);
    }
    public expr(): ExprContext | null {
        return this.getRuleContext(0, ExprContext);
    }
    public CLOSE_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CLOSE_PAR, 0);
    }
    public DEFAULT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DEFAULT_, 0);
    }
    public COLLATE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.COLLATE_, 0);
    }
    public collation_name(): Collation_nameContext | null {
        return this.getRuleContext(0, Collation_nameContext);
    }
    public foreign_key_clause(): Foreign_key_clauseContext | null {
        return this.getRuleContext(0, Foreign_key_clauseContext);
    }
    public AS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.AS_, 0);
    }
    public CONSTRAINT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CONSTRAINT_, 0);
    }
    public name(): NameContext | null {
        return this.getRuleContext(0, NameContext);
    }
    public NULL_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NULL_, 0);
    }
    public UNIQUE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.UNIQUE_, 0);
    }
    public signed_number(): Signed_numberContext | null {
        return this.getRuleContext(0, Signed_numberContext);
    }
    public literal_value(): Literal_valueContext | null {
        return this.getRuleContext(0, Literal_valueContext);
    }
    public asc_desc(): Asc_descContext | null {
        return this.getRuleContext(0, Asc_descContext);
    }
    public conflict_clause(): Conflict_clauseContext | null {
        return this.getRuleContext(0, Conflict_clauseContext);
    }
    public AUTOINCREMENT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.AUTOINCREMENT_, 0);
    }
    public GENERATED_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.GENERATED_, 0);
    }
    public ALWAYS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ALWAYS_, 0);
    }
    public STORED_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.STORED_, 0);
    }
    public VIRTUAL_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.VIRTUAL_, 0);
    }
    public NOT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NOT_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_column_constraint;
    }
}


export class Signed_numberContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public NUMERIC_LITERAL(): antlr.TerminalNode {
        return this.getToken(SqliteParser.NUMERIC_LITERAL, 0)!;
    }
    public PLUS(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.PLUS, 0);
    }
    public MINUS(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.MINUS, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_signed_number;
    }
}


export class Table_constraintContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public OPEN_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OPEN_PAR, 0);
    }
    public indexed_column(): Indexed_columnContext[];
    public indexed_column(i: number): Indexed_columnContext | null;
    public indexed_column(i?: number): Indexed_columnContext[] | Indexed_columnContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Indexed_columnContext);
        }

        return this.getRuleContext(i, Indexed_columnContext);
    }
    public CLOSE_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CLOSE_PAR, 0);
    }
    public CHECK_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CHECK_, 0);
    }
    public expr(): ExprContext | null {
        return this.getRuleContext(0, ExprContext);
    }
    public FOREIGN_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.FOREIGN_, 0);
    }
    public KEY_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.KEY_, 0);
    }
    public column_name(): Column_nameContext[];
    public column_name(i: number): Column_nameContext | null;
    public column_name(i?: number): Column_nameContext[] | Column_nameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Column_nameContext);
        }

        return this.getRuleContext(i, Column_nameContext);
    }
    public foreign_key_clause(): Foreign_key_clauseContext | null {
        return this.getRuleContext(0, Foreign_key_clauseContext);
    }
    public CONSTRAINT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CONSTRAINT_, 0);
    }
    public name(): NameContext | null {
        return this.getRuleContext(0, NameContext);
    }
    public PRIMARY_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.PRIMARY_, 0);
    }
    public UNIQUE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.UNIQUE_, 0);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public conflict_clause(): Conflict_clauseContext | null {
        return this.getRuleContext(0, Conflict_clauseContext);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_table_constraint;
    }
}


export class Foreign_key_clauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public REFERENCES_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.REFERENCES_, 0)!;
    }
    public foreign_table(): Foreign_tableContext {
        return this.getRuleContext(0, Foreign_tableContext)!;
    }
    public OPEN_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OPEN_PAR, 0);
    }
    public column_name(): Column_nameContext[];
    public column_name(i: number): Column_nameContext | null;
    public column_name(i?: number): Column_nameContext[] | Column_nameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Column_nameContext);
        }

        return this.getRuleContext(i, Column_nameContext);
    }
    public CLOSE_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CLOSE_PAR, 0);
    }
    public ON_(): antlr.TerminalNode[];
    public ON_(i: number): antlr.TerminalNode | null;
    public ON_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.ON_);
    	} else {
    		return this.getToken(SqliteParser.ON_, i);
    	}
    }
    public MATCH_(): antlr.TerminalNode[];
    public MATCH_(i: number): antlr.TerminalNode | null;
    public MATCH_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.MATCH_);
    	} else {
    		return this.getToken(SqliteParser.MATCH_, i);
    	}
    }
    public name(): NameContext[];
    public name(i: number): NameContext | null;
    public name(i?: number): NameContext[] | NameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(NameContext);
        }

        return this.getRuleContext(i, NameContext);
    }
    public DEFERRABLE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DEFERRABLE_, 0);
    }
    public DELETE_(): antlr.TerminalNode[];
    public DELETE_(i: number): antlr.TerminalNode | null;
    public DELETE_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.DELETE_);
    	} else {
    		return this.getToken(SqliteParser.DELETE_, i);
    	}
    }
    public UPDATE_(): antlr.TerminalNode[];
    public UPDATE_(i: number): antlr.TerminalNode | null;
    public UPDATE_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.UPDATE_);
    	} else {
    		return this.getToken(SqliteParser.UPDATE_, i);
    	}
    }
    public SET_(): antlr.TerminalNode[];
    public SET_(i: number): antlr.TerminalNode | null;
    public SET_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.SET_);
    	} else {
    		return this.getToken(SqliteParser.SET_, i);
    	}
    }
    public CASCADE_(): antlr.TerminalNode[];
    public CASCADE_(i: number): antlr.TerminalNode | null;
    public CASCADE_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.CASCADE_);
    	} else {
    		return this.getToken(SqliteParser.CASCADE_, i);
    	}
    }
    public RESTRICT_(): antlr.TerminalNode[];
    public RESTRICT_(i: number): antlr.TerminalNode | null;
    public RESTRICT_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.RESTRICT_);
    	} else {
    		return this.getToken(SqliteParser.RESTRICT_, i);
    	}
    }
    public NO_(): antlr.TerminalNode[];
    public NO_(i: number): antlr.TerminalNode | null;
    public NO_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.NO_);
    	} else {
    		return this.getToken(SqliteParser.NO_, i);
    	}
    }
    public ACTION_(): antlr.TerminalNode[];
    public ACTION_(i: number): antlr.TerminalNode | null;
    public ACTION_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.ACTION_);
    	} else {
    		return this.getToken(SqliteParser.ACTION_, i);
    	}
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public NULL_(): antlr.TerminalNode[];
    public NULL_(i: number): antlr.TerminalNode | null;
    public NULL_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.NULL_);
    	} else {
    		return this.getToken(SqliteParser.NULL_, i);
    	}
    }
    public DEFAULT_(): antlr.TerminalNode[];
    public DEFAULT_(i: number): antlr.TerminalNode | null;
    public DEFAULT_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.DEFAULT_);
    	} else {
    		return this.getToken(SqliteParser.DEFAULT_, i);
    	}
    }
    public NOT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NOT_, 0);
    }
    public INITIALLY_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.INITIALLY_, 0);
    }
    public DEFERRED_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DEFERRED_, 0);
    }
    public IMMEDIATE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.IMMEDIATE_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_foreign_key_clause;
    }
}


export class Conflict_clauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public ON_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.ON_, 0)!;
    }
    public CONFLICT_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.CONFLICT_, 0)!;
    }
    public ROLLBACK_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ROLLBACK_, 0);
    }
    public ABORT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ABORT_, 0);
    }
    public FAIL_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.FAIL_, 0);
    }
    public IGNORE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.IGNORE_, 0);
    }
    public REPLACE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.REPLACE_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_conflict_clause;
    }
}


export class Create_trigger_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public CREATE_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.CREATE_, 0)!;
    }
    public TRIGGER_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.TRIGGER_, 0)!;
    }
    public trigger_name(): Trigger_nameContext {
        return this.getRuleContext(0, Trigger_nameContext)!;
    }
    public ON_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.ON_, 0)!;
    }
    public table_name(): Table_nameContext {
        return this.getRuleContext(0, Table_nameContext)!;
    }
    public BEGIN_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.BEGIN_, 0)!;
    }
    public END_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.END_, 0)!;
    }
    public DELETE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DELETE_, 0);
    }
    public INSERT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.INSERT_, 0);
    }
    public UPDATE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.UPDATE_, 0);
    }
    public IF_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.IF_, 0);
    }
    public NOT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NOT_, 0);
    }
    public EXISTS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.EXISTS_, 0);
    }
    public schema_name(): Schema_nameContext | null {
        return this.getRuleContext(0, Schema_nameContext);
    }
    public DOT(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DOT, 0);
    }
    public BEFORE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.BEFORE_, 0);
    }
    public AFTER_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.AFTER_, 0);
    }
    public INSTEAD_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.INSTEAD_, 0);
    }
    public OF_(): antlr.TerminalNode[];
    public OF_(i: number): antlr.TerminalNode | null;
    public OF_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.OF_);
    	} else {
    		return this.getToken(SqliteParser.OF_, i);
    	}
    }
    public FOR_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.FOR_, 0);
    }
    public EACH_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.EACH_, 0);
    }
    public ROW_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ROW_, 0);
    }
    public WHEN_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.WHEN_, 0);
    }
    public expr(): ExprContext | null {
        return this.getRuleContext(0, ExprContext);
    }
    public SCOL(): antlr.TerminalNode[];
    public SCOL(i: number): antlr.TerminalNode | null;
    public SCOL(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.SCOL);
    	} else {
    		return this.getToken(SqliteParser.SCOL, i);
    	}
    }
    public TEMP_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.TEMP_, 0);
    }
    public TEMPORARY_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.TEMPORARY_, 0);
    }
    public column_name(): Column_nameContext[];
    public column_name(i: number): Column_nameContext | null;
    public column_name(i?: number): Column_nameContext[] | Column_nameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Column_nameContext);
        }

        return this.getRuleContext(i, Column_nameContext);
    }
    public update_stmt(): Update_stmtContext[];
    public update_stmt(i: number): Update_stmtContext | null;
    public update_stmt(i?: number): Update_stmtContext[] | Update_stmtContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Update_stmtContext);
        }

        return this.getRuleContext(i, Update_stmtContext);
    }
    public insert_stmt(): Insert_stmtContext[];
    public insert_stmt(i: number): Insert_stmtContext | null;
    public insert_stmt(i?: number): Insert_stmtContext[] | Insert_stmtContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Insert_stmtContext);
        }

        return this.getRuleContext(i, Insert_stmtContext);
    }
    public delete_stmt(): Delete_stmtContext[];
    public delete_stmt(i: number): Delete_stmtContext | null;
    public delete_stmt(i?: number): Delete_stmtContext[] | Delete_stmtContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Delete_stmtContext);
        }

        return this.getRuleContext(i, Delete_stmtContext);
    }
    public select_stmt(): Select_stmtContext[];
    public select_stmt(i: number): Select_stmtContext | null;
    public select_stmt(i?: number): Select_stmtContext[] | Select_stmtContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Select_stmtContext);
        }

        return this.getRuleContext(i, Select_stmtContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_create_trigger_stmt;
    }
}


export class Create_view_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public CREATE_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.CREATE_, 0)!;
    }
    public VIEW_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.VIEW_, 0)!;
    }
    public view_name(): View_nameContext {
        return this.getRuleContext(0, View_nameContext)!;
    }
    public AS_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.AS_, 0)!;
    }
    public select_stmt(): Select_stmtContext {
        return this.getRuleContext(0, Select_stmtContext)!;
    }
    public IF_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.IF_, 0);
    }
    public NOT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NOT_, 0);
    }
    public EXISTS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.EXISTS_, 0);
    }
    public schema_name(): Schema_nameContext | null {
        return this.getRuleContext(0, Schema_nameContext);
    }
    public DOT(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DOT, 0);
    }
    public OPEN_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OPEN_PAR, 0);
    }
    public column_name(): Column_nameContext[];
    public column_name(i: number): Column_nameContext | null;
    public column_name(i?: number): Column_nameContext[] | Column_nameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Column_nameContext);
        }

        return this.getRuleContext(i, Column_nameContext);
    }
    public CLOSE_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CLOSE_PAR, 0);
    }
    public TEMP_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.TEMP_, 0);
    }
    public TEMPORARY_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.TEMPORARY_, 0);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_create_view_stmt;
    }
}


export class Create_virtual_table_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public CREATE_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.CREATE_, 0)!;
    }
    public VIRTUAL_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.VIRTUAL_, 0)!;
    }
    public TABLE_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.TABLE_, 0)!;
    }
    public table_name(): Table_nameContext {
        return this.getRuleContext(0, Table_nameContext)!;
    }
    public USING_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.USING_, 0)!;
    }
    public module_name(): Module_nameContext {
        return this.getRuleContext(0, Module_nameContext)!;
    }
    public IF_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.IF_, 0);
    }
    public NOT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NOT_, 0);
    }
    public EXISTS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.EXISTS_, 0);
    }
    public schema_name(): Schema_nameContext | null {
        return this.getRuleContext(0, Schema_nameContext);
    }
    public DOT(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DOT, 0);
    }
    public OPEN_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OPEN_PAR, 0);
    }
    public module_argument(): Module_argumentContext[];
    public module_argument(i: number): Module_argumentContext | null;
    public module_argument(i?: number): Module_argumentContext[] | Module_argumentContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Module_argumentContext);
        }

        return this.getRuleContext(i, Module_argumentContext);
    }
    public CLOSE_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CLOSE_PAR, 0);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_create_virtual_table_stmt;
    }
}


export class With_clauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public WITH_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.WITH_, 0)!;
    }
    public common_table_expression(): Common_table_expressionContext[];
    public common_table_expression(i: number): Common_table_expressionContext | null;
    public common_table_expression(i?: number): Common_table_expressionContext[] | Common_table_expressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Common_table_expressionContext);
        }

        return this.getRuleContext(i, Common_table_expressionContext);
    }
    public RECURSIVE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.RECURSIVE_, 0);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_with_clause;
    }
}


export class Common_table_expressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public cte_table_name(): Cte_table_nameContext {
        return this.getRuleContext(0, Cte_table_nameContext)!;
    }
    public AS_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.AS_, 0)!;
    }
    public OPEN_PAR(): antlr.TerminalNode {
        return this.getToken(SqliteParser.OPEN_PAR, 0)!;
    }
    public select_stmt(): Select_stmtContext {
        return this.getRuleContext(0, Select_stmtContext)!;
    }
    public CLOSE_PAR(): antlr.TerminalNode {
        return this.getToken(SqliteParser.CLOSE_PAR, 0)!;
    }
    public MATERIALIZED_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.MATERIALIZED_, 0);
    }
    public NOT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NOT_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_common_table_expression;
    }
}


export class Cte_table_nameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public table_name(): Table_nameContext {
        return this.getRuleContext(0, Table_nameContext)!;
    }
    public OPEN_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OPEN_PAR, 0);
    }
    public column_name(): Column_nameContext[];
    public column_name(i: number): Column_nameContext | null;
    public column_name(i?: number): Column_nameContext[] | Column_nameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Column_nameContext);
        }

        return this.getRuleContext(i, Column_nameContext);
    }
    public CLOSE_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CLOSE_PAR, 0);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_cte_table_name;
    }
}


export class Delete_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public DELETE_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.DELETE_, 0)!;
    }
    public FROM_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.FROM_, 0)!;
    }
    public qualified_table_name(): Qualified_table_nameContext {
        return this.getRuleContext(0, Qualified_table_nameContext)!;
    }
    public with_clause(): With_clauseContext | null {
        return this.getRuleContext(0, With_clauseContext);
    }
    public WHERE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.WHERE_, 0);
    }
    public expr(): ExprContext | null {
        return this.getRuleContext(0, ExprContext);
    }
    public returning_clause(): Returning_clauseContext | null {
        return this.getRuleContext(0, Returning_clauseContext);
    }
    public order_clause(): Order_clauseContext | null {
        return this.getRuleContext(0, Order_clauseContext);
    }
    public limit_clause(): Limit_clauseContext | null {
        return this.getRuleContext(0, Limit_clauseContext);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_delete_stmt;
    }
}


export class Detach_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public DETACH_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.DETACH_, 0)!;
    }
    public schema_name(): Schema_nameContext {
        return this.getRuleContext(0, Schema_nameContext)!;
    }
    public DATABASE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DATABASE_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_detach_stmt;
    }
}


export class Drop_stmtContext extends antlr.ParserRuleContext {
    public _object?: Token | null;
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public DROP_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.DROP_, 0)!;
    }
    public any_name(): Any_nameContext {
        return this.getRuleContext(0, Any_nameContext)!;
    }
    public INDEX_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.INDEX_, 0);
    }
    public TABLE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.TABLE_, 0);
    }
    public TRIGGER_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.TRIGGER_, 0);
    }
    public VIEW_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.VIEW_, 0);
    }
    public IF_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.IF_, 0);
    }
    public EXISTS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.EXISTS_, 0);
    }
    public schema_name(): Schema_nameContext | null {
        return this.getRuleContext(0, Schema_nameContext);
    }
    public DOT(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DOT, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_drop_stmt;
    }
}


export class ExprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr_or(): Expr_orContext {
        return this.getRuleContext(0, Expr_orContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_expr;
    }
}


export class Expr_orContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr_and(): Expr_andContext[];
    public expr_and(i: number): Expr_andContext | null;
    public expr_and(i?: number): Expr_andContext[] | Expr_andContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Expr_andContext);
        }

        return this.getRuleContext(i, Expr_andContext);
    }
    public OR_(): antlr.TerminalNode[];
    public OR_(i: number): antlr.TerminalNode | null;
    public OR_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.OR_);
    	} else {
    		return this.getToken(SqliteParser.OR_, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_expr_or;
    }
}


export class Expr_andContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr_not(): Expr_notContext[];
    public expr_not(i: number): Expr_notContext | null;
    public expr_not(i?: number): Expr_notContext[] | Expr_notContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Expr_notContext);
        }

        return this.getRuleContext(i, Expr_notContext);
    }
    public AND_(): antlr.TerminalNode[];
    public AND_(i: number): antlr.TerminalNode | null;
    public AND_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.AND_);
    	} else {
    		return this.getToken(SqliteParser.AND_, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_expr_and;
    }
}


export class Expr_notContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr_binary(): Expr_binaryContext {
        return this.getRuleContext(0, Expr_binaryContext)!;
    }
    public NOT_(): antlr.TerminalNode[];
    public NOT_(i: number): antlr.TerminalNode | null;
    public NOT_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.NOT_);
    	} else {
    		return this.getToken(SqliteParser.NOT_, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_expr_not;
    }
}


export class Expr_binaryContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr_comparison(): Expr_comparisonContext[];
    public expr_comparison(i: number): Expr_comparisonContext | null;
    public expr_comparison(i?: number): Expr_comparisonContext[] | Expr_comparisonContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Expr_comparisonContext);
        }

        return this.getRuleContext(i, Expr_comparisonContext);
    }
    public IS_(): antlr.TerminalNode[];
    public IS_(i: number): antlr.TerminalNode | null;
    public IS_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.IS_);
    	} else {
    		return this.getToken(SqliteParser.IS_, i);
    	}
    }
    public BETWEEN_(): antlr.TerminalNode[];
    public BETWEEN_(i: number): antlr.TerminalNode | null;
    public BETWEEN_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.BETWEEN_);
    	} else {
    		return this.getToken(SqliteParser.BETWEEN_, i);
    	}
    }
    public AND_(): antlr.TerminalNode[];
    public AND_(i: number): antlr.TerminalNode | null;
    public AND_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.AND_);
    	} else {
    		return this.getToken(SqliteParser.AND_, i);
    	}
    }
    public IN_(): antlr.TerminalNode[];
    public IN_(i: number): antlr.TerminalNode | null;
    public IN_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.IN_);
    	} else {
    		return this.getToken(SqliteParser.IN_, i);
    	}
    }
    public ISNULL_(): antlr.TerminalNode[];
    public ISNULL_(i: number): antlr.TerminalNode | null;
    public ISNULL_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.ISNULL_);
    	} else {
    		return this.getToken(SqliteParser.ISNULL_, i);
    	}
    }
    public NOTNULL_(): antlr.TerminalNode[];
    public NOTNULL_(i: number): antlr.TerminalNode | null;
    public NOTNULL_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.NOTNULL_);
    	} else {
    		return this.getToken(SqliteParser.NOTNULL_, i);
    	}
    }
    public NOT_(): antlr.TerminalNode[];
    public NOT_(i: number): antlr.TerminalNode | null;
    public NOT_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.NOT_);
    	} else {
    		return this.getToken(SqliteParser.NOT_, i);
    	}
    }
    public NULL_(): antlr.TerminalNode[];
    public NULL_(i: number): antlr.TerminalNode | null;
    public NULL_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.NULL_);
    	} else {
    		return this.getToken(SqliteParser.NULL_, i);
    	}
    }
    public ASSIGN(): antlr.TerminalNode[];
    public ASSIGN(i: number): antlr.TerminalNode | null;
    public ASSIGN(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.ASSIGN);
    	} else {
    		return this.getToken(SqliteParser.ASSIGN, i);
    	}
    }
    public EQ(): antlr.TerminalNode[];
    public EQ(i: number): antlr.TerminalNode | null;
    public EQ(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.EQ);
    	} else {
    		return this.getToken(SqliteParser.EQ, i);
    	}
    }
    public NOT_EQ1(): antlr.TerminalNode[];
    public NOT_EQ1(i: number): antlr.TerminalNode | null;
    public NOT_EQ1(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.NOT_EQ1);
    	} else {
    		return this.getToken(SqliteParser.NOT_EQ1, i);
    	}
    }
    public NOT_EQ2(): antlr.TerminalNode[];
    public NOT_EQ2(i: number): antlr.TerminalNode | null;
    public NOT_EQ2(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.NOT_EQ2);
    	} else {
    		return this.getToken(SqliteParser.NOT_EQ2, i);
    	}
    }
    public OPEN_PAR(): antlr.TerminalNode[];
    public OPEN_PAR(i: number): antlr.TerminalNode | null;
    public OPEN_PAR(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.OPEN_PAR);
    	} else {
    		return this.getToken(SqliteParser.OPEN_PAR, i);
    	}
    }
    public CLOSE_PAR(): antlr.TerminalNode[];
    public CLOSE_PAR(i: number): antlr.TerminalNode | null;
    public CLOSE_PAR(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.CLOSE_PAR);
    	} else {
    		return this.getToken(SqliteParser.CLOSE_PAR, i);
    	}
    }
    public table_name(): Table_nameContext[];
    public table_name(i: number): Table_nameContext | null;
    public table_name(i?: number): Table_nameContext[] | Table_nameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Table_nameContext);
        }

        return this.getRuleContext(i, Table_nameContext);
    }
    public table_function_name(): Table_function_nameContext[];
    public table_function_name(i: number): Table_function_nameContext | null;
    public table_function_name(i?: number): Table_function_nameContext[] | Table_function_nameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Table_function_nameContext);
        }

        return this.getRuleContext(i, Table_function_nameContext);
    }
    public LIKE_(): antlr.TerminalNode[];
    public LIKE_(i: number): antlr.TerminalNode | null;
    public LIKE_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.LIKE_);
    	} else {
    		return this.getToken(SqliteParser.LIKE_, i);
    	}
    }
    public DISTINCT_(): antlr.TerminalNode[];
    public DISTINCT_(i: number): antlr.TerminalNode | null;
    public DISTINCT_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.DISTINCT_);
    	} else {
    		return this.getToken(SqliteParser.DISTINCT_, i);
    	}
    }
    public FROM_(): antlr.TerminalNode[];
    public FROM_(i: number): antlr.TerminalNode | null;
    public FROM_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.FROM_);
    	} else {
    		return this.getToken(SqliteParser.FROM_, i);
    	}
    }
    public GLOB_(): antlr.TerminalNode[];
    public GLOB_(i: number): antlr.TerminalNode | null;
    public GLOB_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.GLOB_);
    	} else {
    		return this.getToken(SqliteParser.GLOB_, i);
    	}
    }
    public REGEXP_(): antlr.TerminalNode[];
    public REGEXP_(i: number): antlr.TerminalNode | null;
    public REGEXP_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.REGEXP_);
    	} else {
    		return this.getToken(SqliteParser.REGEXP_, i);
    	}
    }
    public MATCH_(): antlr.TerminalNode[];
    public MATCH_(i: number): antlr.TerminalNode | null;
    public MATCH_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.MATCH_);
    	} else {
    		return this.getToken(SqliteParser.MATCH_, i);
    	}
    }
    public select_stmt(): Select_stmtContext[];
    public select_stmt(i: number): Select_stmtContext | null;
    public select_stmt(i?: number): Select_stmtContext[] | Select_stmtContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Select_stmtContext);
        }

        return this.getRuleContext(i, Select_stmtContext);
    }
    public schema_name(): Schema_nameContext[];
    public schema_name(i: number): Schema_nameContext | null;
    public schema_name(i?: number): Schema_nameContext[] | Schema_nameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Schema_nameContext);
        }

        return this.getRuleContext(i, Schema_nameContext);
    }
    public DOT(): antlr.TerminalNode[];
    public DOT(i: number): antlr.TerminalNode | null;
    public DOT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.DOT);
    	} else {
    		return this.getToken(SqliteParser.DOT, i);
    	}
    }
    public ESCAPE_(): antlr.TerminalNode[];
    public ESCAPE_(i: number): antlr.TerminalNode | null;
    public ESCAPE_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.ESCAPE_);
    	} else {
    		return this.getToken(SqliteParser.ESCAPE_, i);
    	}
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_expr_binary;
    }
}


export class Expr_comparisonContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr_bitwise(): Expr_bitwiseContext[];
    public expr_bitwise(i: number): Expr_bitwiseContext | null;
    public expr_bitwise(i?: number): Expr_bitwiseContext[] | Expr_bitwiseContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Expr_bitwiseContext);
        }

        return this.getRuleContext(i, Expr_bitwiseContext);
    }
    public LT(): antlr.TerminalNode[];
    public LT(i: number): antlr.TerminalNode | null;
    public LT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.LT);
    	} else {
    		return this.getToken(SqliteParser.LT, i);
    	}
    }
    public LT_EQ(): antlr.TerminalNode[];
    public LT_EQ(i: number): antlr.TerminalNode | null;
    public LT_EQ(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.LT_EQ);
    	} else {
    		return this.getToken(SqliteParser.LT_EQ, i);
    	}
    }
    public GT(): antlr.TerminalNode[];
    public GT(i: number): antlr.TerminalNode | null;
    public GT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.GT);
    	} else {
    		return this.getToken(SqliteParser.GT, i);
    	}
    }
    public GT_EQ(): antlr.TerminalNode[];
    public GT_EQ(i: number): antlr.TerminalNode | null;
    public GT_EQ(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.GT_EQ);
    	} else {
    		return this.getToken(SqliteParser.GT_EQ, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_expr_comparison;
    }
}


export class Expr_bitwiseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr_addition(): Expr_additionContext[];
    public expr_addition(i: number): Expr_additionContext | null;
    public expr_addition(i?: number): Expr_additionContext[] | Expr_additionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Expr_additionContext);
        }

        return this.getRuleContext(i, Expr_additionContext);
    }
    public LT2(): antlr.TerminalNode[];
    public LT2(i: number): antlr.TerminalNode | null;
    public LT2(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.LT2);
    	} else {
    		return this.getToken(SqliteParser.LT2, i);
    	}
    }
    public GT2(): antlr.TerminalNode[];
    public GT2(i: number): antlr.TerminalNode | null;
    public GT2(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.GT2);
    	} else {
    		return this.getToken(SqliteParser.GT2, i);
    	}
    }
    public AMP(): antlr.TerminalNode[];
    public AMP(i: number): antlr.TerminalNode | null;
    public AMP(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.AMP);
    	} else {
    		return this.getToken(SqliteParser.AMP, i);
    	}
    }
    public PIPE(): antlr.TerminalNode[];
    public PIPE(i: number): antlr.TerminalNode | null;
    public PIPE(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.PIPE);
    	} else {
    		return this.getToken(SqliteParser.PIPE, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_expr_bitwise;
    }
}


export class Expr_additionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr_multiplication(): Expr_multiplicationContext[];
    public expr_multiplication(i: number): Expr_multiplicationContext | null;
    public expr_multiplication(i?: number): Expr_multiplicationContext[] | Expr_multiplicationContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Expr_multiplicationContext);
        }

        return this.getRuleContext(i, Expr_multiplicationContext);
    }
    public PLUS(): antlr.TerminalNode[];
    public PLUS(i: number): antlr.TerminalNode | null;
    public PLUS(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.PLUS);
    	} else {
    		return this.getToken(SqliteParser.PLUS, i);
    	}
    }
    public MINUS(): antlr.TerminalNode[];
    public MINUS(i: number): antlr.TerminalNode | null;
    public MINUS(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.MINUS);
    	} else {
    		return this.getToken(SqliteParser.MINUS, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_expr_addition;
    }
}


export class Expr_multiplicationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr_string(): Expr_stringContext[];
    public expr_string(i: number): Expr_stringContext | null;
    public expr_string(i?: number): Expr_stringContext[] | Expr_stringContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Expr_stringContext);
        }

        return this.getRuleContext(i, Expr_stringContext);
    }
    public STAR(): antlr.TerminalNode[];
    public STAR(i: number): antlr.TerminalNode | null;
    public STAR(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.STAR);
    	} else {
    		return this.getToken(SqliteParser.STAR, i);
    	}
    }
    public DIV(): antlr.TerminalNode[];
    public DIV(i: number): antlr.TerminalNode | null;
    public DIV(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.DIV);
    	} else {
    		return this.getToken(SqliteParser.DIV, i);
    	}
    }
    public MOD(): antlr.TerminalNode[];
    public MOD(i: number): antlr.TerminalNode | null;
    public MOD(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.MOD);
    	} else {
    		return this.getToken(SqliteParser.MOD, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_expr_multiplication;
    }
}


export class Expr_stringContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr_collate(): Expr_collateContext[];
    public expr_collate(i: number): Expr_collateContext | null;
    public expr_collate(i?: number): Expr_collateContext[] | Expr_collateContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Expr_collateContext);
        }

        return this.getRuleContext(i, Expr_collateContext);
    }
    public PIPE2(): antlr.TerminalNode[];
    public PIPE2(i: number): antlr.TerminalNode | null;
    public PIPE2(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.PIPE2);
    	} else {
    		return this.getToken(SqliteParser.PIPE2, i);
    	}
    }
    public JPTR(): antlr.TerminalNode[];
    public JPTR(i: number): antlr.TerminalNode | null;
    public JPTR(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.JPTR);
    	} else {
    		return this.getToken(SqliteParser.JPTR, i);
    	}
    }
    public JPTR2(): antlr.TerminalNode[];
    public JPTR2(i: number): antlr.TerminalNode | null;
    public JPTR2(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.JPTR2);
    	} else {
    		return this.getToken(SqliteParser.JPTR2, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_expr_string;
    }
}


export class Expr_collateContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr_unary(): Expr_unaryContext {
        return this.getRuleContext(0, Expr_unaryContext)!;
    }
    public COLLATE_(): antlr.TerminalNode[];
    public COLLATE_(i: number): antlr.TerminalNode | null;
    public COLLATE_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COLLATE_);
    	} else {
    		return this.getToken(SqliteParser.COLLATE_, i);
    	}
    }
    public collation_name(): Collation_nameContext[];
    public collation_name(i: number): Collation_nameContext | null;
    public collation_name(i?: number): Collation_nameContext[] | Collation_nameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Collation_nameContext);
        }

        return this.getRuleContext(i, Collation_nameContext);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_expr_collate;
    }
}


export class Expr_unaryContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr_base(): Expr_baseContext {
        return this.getRuleContext(0, Expr_baseContext)!;
    }
    public MINUS(): antlr.TerminalNode[];
    public MINUS(i: number): antlr.TerminalNode | null;
    public MINUS(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.MINUS);
    	} else {
    		return this.getToken(SqliteParser.MINUS, i);
    	}
    }
    public PLUS(): antlr.TerminalNode[];
    public PLUS(i: number): antlr.TerminalNode | null;
    public PLUS(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.PLUS);
    	} else {
    		return this.getToken(SqliteParser.PLUS, i);
    	}
    }
    public TILDE(): antlr.TerminalNode[];
    public TILDE(i: number): antlr.TerminalNode | null;
    public TILDE(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.TILDE);
    	} else {
    		return this.getToken(SqliteParser.TILDE, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_expr_unary;
    }
}


export class Expr_baseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public literal_value(): Literal_valueContext | null {
        return this.getRuleContext(0, Literal_valueContext);
    }
    public BIND_PARAMETER(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.BIND_PARAMETER, 0);
    }
    public table_name(): Table_nameContext | null {
        return this.getRuleContext(0, Table_nameContext);
    }
    public DOT(): antlr.TerminalNode[];
    public DOT(i: number): antlr.TerminalNode | null;
    public DOT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.DOT);
    	} else {
    		return this.getToken(SqliteParser.DOT, i);
    	}
    }
    public column_name(): Column_nameContext | null {
        return this.getRuleContext(0, Column_nameContext);
    }
    public schema_name(): Schema_nameContext | null {
        return this.getRuleContext(0, Schema_nameContext);
    }
    public column_name_excluding_string(): Column_name_excluding_stringContext | null {
        return this.getRuleContext(0, Column_name_excluding_stringContext);
    }
    public OPEN_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OPEN_PAR, 0);
    }
    public select_stmt(): Select_stmtContext | null {
        return this.getRuleContext(0, Select_stmtContext);
    }
    public CLOSE_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CLOSE_PAR, 0);
    }
    public EXISTS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.EXISTS_, 0);
    }
    public NOT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NOT_, 0);
    }
    public raise_function(): Raise_functionContext | null {
        return this.getRuleContext(0, Raise_functionContext);
    }
    public expr_recursive(): Expr_recursiveContext | null {
        return this.getRuleContext(0, Expr_recursiveContext);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_expr_base;
    }
}


export class Expr_recursiveContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public function_name(): Function_nameContext | null {
        return this.getRuleContext(0, Function_nameContext);
    }
    public OPEN_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OPEN_PAR, 0);
    }
    public CLOSE_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CLOSE_PAR, 0);
    }
    public expr(): ExprContext[];
    public expr(i: number): ExprContext | null;
    public expr(i?: number): ExprContext[] | ExprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExprContext);
        }

        return this.getRuleContext(i, ExprContext);
    }
    public STAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.STAR, 0);
    }
    public percentile_clause(): Percentile_clauseContext | null {
        return this.getRuleContext(0, Percentile_clauseContext);
    }
    public filter_clause(): Filter_clauseContext | null {
        return this.getRuleContext(0, Filter_clauseContext);
    }
    public over_clause(): Over_clauseContext | null {
        return this.getRuleContext(0, Over_clauseContext);
    }
    public DISTINCT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DISTINCT_, 0);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public order_clause(): Order_clauseContext | null {
        return this.getRuleContext(0, Order_clauseContext);
    }
    public CAST_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CAST_, 0);
    }
    public AS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.AS_, 0);
    }
    public type_name(): Type_nameContext | null {
        return this.getRuleContext(0, Type_nameContext);
    }
    public CASE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CASE_, 0);
    }
    public END_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.END_, 0);
    }
    public WHEN_(): antlr.TerminalNode[];
    public WHEN_(i: number): antlr.TerminalNode | null;
    public WHEN_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.WHEN_);
    	} else {
    		return this.getToken(SqliteParser.WHEN_, i);
    	}
    }
    public THEN_(): antlr.TerminalNode[];
    public THEN_(i: number): antlr.TerminalNode | null;
    public THEN_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.THEN_);
    	} else {
    		return this.getToken(SqliteParser.THEN_, i);
    	}
    }
    public ELSE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ELSE_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_expr_recursive;
    }
}


export class Raise_functionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public RAISE_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.RAISE_, 0)!;
    }
    public OPEN_PAR(): antlr.TerminalNode {
        return this.getToken(SqliteParser.OPEN_PAR, 0)!;
    }
    public CLOSE_PAR(): antlr.TerminalNode {
        return this.getToken(SqliteParser.CLOSE_PAR, 0)!;
    }
    public IGNORE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.IGNORE_, 0);
    }
    public COMMA(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.COMMA, 0);
    }
    public error_message(): Error_messageContext | null {
        return this.getRuleContext(0, Error_messageContext);
    }
    public ROLLBACK_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ROLLBACK_, 0);
    }
    public ABORT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ABORT_, 0);
    }
    public FAIL_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.FAIL_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_raise_function;
    }
}


export class Literal_valueContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public NUMERIC_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NUMERIC_LITERAL, 0);
    }
    public STRING_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.STRING_LITERAL, 0);
    }
    public BLOB_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.BLOB_LITERAL, 0);
    }
    public NULL_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NULL_, 0);
    }
    public TRUE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.TRUE_, 0);
    }
    public FALSE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.FALSE_, 0);
    }
    public CURRENT_TIME_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CURRENT_TIME_, 0);
    }
    public CURRENT_DATE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CURRENT_DATE_, 0);
    }
    public CURRENT_TIMESTAMP_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CURRENT_TIMESTAMP_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_literal_value;
    }
}


export class Percentile_clauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public WITHIN_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.WITHIN_, 0)!;
    }
    public GROUP_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.GROUP_, 0)!;
    }
    public OPEN_PAR(): antlr.TerminalNode {
        return this.getToken(SqliteParser.OPEN_PAR, 0)!;
    }
    public ORDER_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.ORDER_, 0)!;
    }
    public BY_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.BY_, 0)!;
    }
    public expr(): ExprContext {
        return this.getRuleContext(0, ExprContext)!;
    }
    public CLOSE_PAR(): antlr.TerminalNode {
        return this.getToken(SqliteParser.CLOSE_PAR, 0)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_percentile_clause;
    }
}


export class Value_rowContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public OPEN_PAR(): antlr.TerminalNode {
        return this.getToken(SqliteParser.OPEN_PAR, 0)!;
    }
    public expr(): ExprContext[];
    public expr(i: number): ExprContext | null;
    public expr(i?: number): ExprContext[] | ExprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExprContext);
        }

        return this.getRuleContext(i, ExprContext);
    }
    public CLOSE_PAR(): antlr.TerminalNode {
        return this.getToken(SqliteParser.CLOSE_PAR, 0)!;
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_value_row;
    }
}


export class Values_clauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public VALUES_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.VALUES_, 0)!;
    }
    public value_row(): Value_rowContext[];
    public value_row(i: number): Value_rowContext | null;
    public value_row(i?: number): Value_rowContext[] | Value_rowContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Value_rowContext);
        }

        return this.getRuleContext(i, Value_rowContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_values_clause;
    }
}


export class Insert_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public INTO_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.INTO_, 0)!;
    }
    public table_name(): Table_nameContext {
        return this.getRuleContext(0, Table_nameContext)!;
    }
    public INSERT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.INSERT_, 0);
    }
    public REPLACE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.REPLACE_, 0);
    }
    public OR_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OR_, 0);
    }
    public select_stmt(): Select_stmtContext | null {
        return this.getRuleContext(0, Select_stmtContext);
    }
    public DEFAULT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DEFAULT_, 0);
    }
    public VALUES_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.VALUES_, 0);
    }
    public with_clause(): With_clauseContext | null {
        return this.getRuleContext(0, With_clauseContext);
    }
    public ROLLBACK_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ROLLBACK_, 0);
    }
    public ABORT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ABORT_, 0);
    }
    public FAIL_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.FAIL_, 0);
    }
    public IGNORE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.IGNORE_, 0);
    }
    public schema_name(): Schema_nameContext | null {
        return this.getRuleContext(0, Schema_nameContext);
    }
    public DOT(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DOT, 0);
    }
    public AS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.AS_, 0);
    }
    public table_alias(): Table_aliasContext | null {
        return this.getRuleContext(0, Table_aliasContext);
    }
    public OPEN_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OPEN_PAR, 0);
    }
    public column_name(): Column_nameContext[];
    public column_name(i: number): Column_nameContext | null;
    public column_name(i?: number): Column_nameContext[] | Column_nameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Column_nameContext);
        }

        return this.getRuleContext(i, Column_nameContext);
    }
    public CLOSE_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CLOSE_PAR, 0);
    }
    public returning_clause(): Returning_clauseContext | null {
        return this.getRuleContext(0, Returning_clauseContext);
    }
    public upsert_clause(): Upsert_clauseContext[];
    public upsert_clause(i: number): Upsert_clauseContext | null;
    public upsert_clause(i?: number): Upsert_clauseContext[] | Upsert_clauseContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Upsert_clauseContext);
        }

        return this.getRuleContext(i, Upsert_clauseContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_insert_stmt;
    }
}


export class Returning_clauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public RETURNING_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.RETURNING_, 0)!;
    }
    public STAR(): antlr.TerminalNode[];
    public STAR(i: number): antlr.TerminalNode | null;
    public STAR(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.STAR);
    	} else {
    		return this.getToken(SqliteParser.STAR, i);
    	}
    }
    public expr(): ExprContext[];
    public expr(i: number): ExprContext | null;
    public expr(i?: number): ExprContext[] | ExprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExprContext);
        }

        return this.getRuleContext(i, ExprContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public column_alias(): Column_aliasContext[];
    public column_alias(i: number): Column_aliasContext | null;
    public column_alias(i?: number): Column_aliasContext[] | Column_aliasContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Column_aliasContext);
        }

        return this.getRuleContext(i, Column_aliasContext);
    }
    public AS_(): antlr.TerminalNode[];
    public AS_(i: number): antlr.TerminalNode | null;
    public AS_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.AS_);
    	} else {
    		return this.getToken(SqliteParser.AS_, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_returning_clause;
    }
}


export class Upsert_clauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public ON_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.ON_, 0)!;
    }
    public CONFLICT_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.CONFLICT_, 0)!;
    }
    public DO_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.DO_, 0)!;
    }
    public NOTHING_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NOTHING_, 0);
    }
    public UPDATE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.UPDATE_, 0);
    }
    public SET_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.SET_, 0);
    }
    public ASSIGN(): antlr.TerminalNode[];
    public ASSIGN(i: number): antlr.TerminalNode | null;
    public ASSIGN(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.ASSIGN);
    	} else {
    		return this.getToken(SqliteParser.ASSIGN, i);
    	}
    }
    public expr(): ExprContext[];
    public expr(i: number): ExprContext | null;
    public expr(i?: number): ExprContext[] | ExprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExprContext);
        }

        return this.getRuleContext(i, ExprContext);
    }
    public OPEN_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OPEN_PAR, 0);
    }
    public indexed_column(): Indexed_columnContext[];
    public indexed_column(i: number): Indexed_columnContext | null;
    public indexed_column(i?: number): Indexed_columnContext[] | Indexed_columnContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Indexed_columnContext);
        }

        return this.getRuleContext(i, Indexed_columnContext);
    }
    public CLOSE_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CLOSE_PAR, 0);
    }
    public column_name(): Column_nameContext[];
    public column_name(i: number): Column_nameContext | null;
    public column_name(i?: number): Column_nameContext[] | Column_nameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Column_nameContext);
        }

        return this.getRuleContext(i, Column_nameContext);
    }
    public column_name_list(): Column_name_listContext[];
    public column_name_list(i: number): Column_name_listContext | null;
    public column_name_list(i?: number): Column_name_listContext[] | Column_name_listContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Column_name_listContext);
        }

        return this.getRuleContext(i, Column_name_listContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public WHERE_(): antlr.TerminalNode[];
    public WHERE_(i: number): antlr.TerminalNode | null;
    public WHERE_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.WHERE_);
    	} else {
    		return this.getToken(SqliteParser.WHERE_, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_upsert_clause;
    }
}


export class Pragma_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public PRAGMA_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.PRAGMA_, 0)!;
    }
    public pragma_name(): Pragma_nameContext {
        return this.getRuleContext(0, Pragma_nameContext)!;
    }
    public schema_name(): Schema_nameContext | null {
        return this.getRuleContext(0, Schema_nameContext);
    }
    public DOT(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DOT, 0);
    }
    public ASSIGN(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ASSIGN, 0);
    }
    public pragma_value(): Pragma_valueContext | null {
        return this.getRuleContext(0, Pragma_valueContext);
    }
    public OPEN_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OPEN_PAR, 0);
    }
    public CLOSE_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CLOSE_PAR, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_pragma_stmt;
    }
}


export class Pragma_valueContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public signed_number(): Signed_numberContext | null {
        return this.getRuleContext(0, Signed_numberContext);
    }
    public name(): NameContext | null {
        return this.getRuleContext(0, NameContext);
    }
    public STRING_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.STRING_LITERAL, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_pragma_value;
    }
}


export class Reindex_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public REINDEX_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.REINDEX_, 0)!;
    }
    public collation_name(): Collation_nameContext | null {
        return this.getRuleContext(0, Collation_nameContext);
    }
    public table_name(): Table_nameContext | null {
        return this.getRuleContext(0, Table_nameContext);
    }
    public index_name(): Index_nameContext | null {
        return this.getRuleContext(0, Index_nameContext);
    }
    public schema_name(): Schema_nameContext | null {
        return this.getRuleContext(0, Schema_nameContext);
    }
    public DOT(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DOT, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_reindex_stmt;
    }
}


export class Select_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public select_core(): Select_coreContext[];
    public select_core(i: number): Select_coreContext | null;
    public select_core(i?: number): Select_coreContext[] | Select_coreContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Select_coreContext);
        }

        return this.getRuleContext(i, Select_coreContext);
    }
    public with_clause(): With_clauseContext | null {
        return this.getRuleContext(0, With_clauseContext);
    }
    public compound_operator(): Compound_operatorContext[];
    public compound_operator(i: number): Compound_operatorContext | null;
    public compound_operator(i?: number): Compound_operatorContext[] | Compound_operatorContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Compound_operatorContext);
        }

        return this.getRuleContext(i, Compound_operatorContext);
    }
    public order_clause(): Order_clauseContext | null {
        return this.getRuleContext(0, Order_clauseContext);
    }
    public limit_clause(): Limit_clauseContext | null {
        return this.getRuleContext(0, Limit_clauseContext);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_select_stmt;
    }
}


export class Join_clauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public table_or_subquery(): Table_or_subqueryContext {
        return this.getRuleContext(0, Table_or_subqueryContext)!;
    }
    public join_step(): Join_stepContext[];
    public join_step(i: number): Join_stepContext | null;
    public join_step(i?: number): Join_stepContext[] | Join_stepContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Join_stepContext);
        }

        return this.getRuleContext(i, Join_stepContext);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_join_clause;
    }
}


export class Join_stepContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public join_operator(): Join_operatorContext {
        return this.getRuleContext(0, Join_operatorContext)!;
    }
    public table_or_subquery(): Table_or_subqueryContext {
        return this.getRuleContext(0, Table_or_subqueryContext)!;
    }
    public join_constraint(): Join_constraintContext | null {
        return this.getRuleContext(0, Join_constraintContext);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_join_step;
    }
}


export class Select_coreContext extends antlr.ParserRuleContext {
    public _where_expr?: ExprContext;
    public _expr?: ExprContext;
    public _group_by_expr: ExprContext[] = [];
    public _having_expr?: ExprContext;
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public SELECT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.SELECT_, 0);
    }
    public result_column(): Result_columnContext[];
    public result_column(i: number): Result_columnContext | null;
    public result_column(i?: number): Result_columnContext[] | Result_columnContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Result_columnContext);
        }

        return this.getRuleContext(i, Result_columnContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public FROM_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.FROM_, 0);
    }
    public join_clause(): Join_clauseContext | null {
        return this.getRuleContext(0, Join_clauseContext);
    }
    public WHERE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.WHERE_, 0);
    }
    public GROUP_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.GROUP_, 0);
    }
    public BY_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.BY_, 0);
    }
    public WINDOW_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.WINDOW_, 0);
    }
    public window_name(): Window_nameContext[];
    public window_name(i: number): Window_nameContext | null;
    public window_name(i?: number): Window_nameContext[] | Window_nameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Window_nameContext);
        }

        return this.getRuleContext(i, Window_nameContext);
    }
    public AS_(): antlr.TerminalNode[];
    public AS_(i: number): antlr.TerminalNode | null;
    public AS_(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.AS_);
    	} else {
    		return this.getToken(SqliteParser.AS_, i);
    	}
    }
    public window_defn(): Window_defnContext[];
    public window_defn(i: number): Window_defnContext | null;
    public window_defn(i?: number): Window_defnContext[] | Window_defnContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Window_defnContext);
        }

        return this.getRuleContext(i, Window_defnContext);
    }
    public DISTINCT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DISTINCT_, 0);
    }
    public ALL_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ALL_, 0);
    }
    public expr(): ExprContext[];
    public expr(i: number): ExprContext | null;
    public expr(i?: number): ExprContext[] | ExprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExprContext);
        }

        return this.getRuleContext(i, ExprContext);
    }
    public HAVING_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.HAVING_, 0);
    }
    public values_clause(): Values_clauseContext | null {
        return this.getRuleContext(0, Values_clauseContext);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_select_core;
    }
}


export class Table_or_subqueryContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public table_name(): Table_nameContext | null {
        return this.getRuleContext(0, Table_nameContext);
    }
    public schema_name(): Schema_nameContext | null {
        return this.getRuleContext(0, Schema_nameContext);
    }
    public DOT(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DOT, 0);
    }
    public AS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.AS_, 0);
    }
    public table_alias(): Table_aliasContext | null {
        return this.getRuleContext(0, Table_aliasContext);
    }
    public table_alias_excluding_joins(): Table_alias_excluding_joinsContext | null {
        return this.getRuleContext(0, Table_alias_excluding_joinsContext);
    }
    public INDEXED_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.INDEXED_, 0);
    }
    public BY_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.BY_, 0);
    }
    public index_name(): Index_nameContext | null {
        return this.getRuleContext(0, Index_nameContext);
    }
    public NOT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NOT_, 0);
    }
    public table_function_name(): Table_function_nameContext | null {
        return this.getRuleContext(0, Table_function_nameContext);
    }
    public OPEN_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OPEN_PAR, 0);
    }
    public expr(): ExprContext[];
    public expr(i: number): ExprContext | null;
    public expr(i?: number): ExprContext[] | ExprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExprContext);
        }

        return this.getRuleContext(i, ExprContext);
    }
    public CLOSE_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CLOSE_PAR, 0);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public join_clause(): Join_clauseContext | null {
        return this.getRuleContext(0, Join_clauseContext);
    }
    public select_stmt(): Select_stmtContext | null {
        return this.getRuleContext(0, Select_stmtContext);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_table_or_subquery;
    }
}


export class Result_columnContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public STAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.STAR, 0);
    }
    public table_name(): Table_nameContext | null {
        return this.getRuleContext(0, Table_nameContext);
    }
    public DOT(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DOT, 0);
    }
    public expr(): ExprContext | null {
        return this.getRuleContext(0, ExprContext);
    }
    public column_alias(): Column_aliasContext | null {
        return this.getRuleContext(0, Column_aliasContext);
    }
    public AS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.AS_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_result_column;
    }
}


export class Join_operatorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public COMMA(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.COMMA, 0);
    }
    public JOIN_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.JOIN_, 0);
    }
    public NATURAL_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NATURAL_, 0);
    }
    public INNER_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.INNER_, 0);
    }
    public CROSS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CROSS_, 0);
    }
    public LEFT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.LEFT_, 0);
    }
    public RIGHT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.RIGHT_, 0);
    }
    public FULL_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.FULL_, 0);
    }
    public OUTER_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OUTER_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_join_operator;
    }
}


export class Join_constraintContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public ON_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ON_, 0);
    }
    public expr(): ExprContext | null {
        return this.getRuleContext(0, ExprContext);
    }
    public USING_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.USING_, 0);
    }
    public OPEN_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OPEN_PAR, 0);
    }
    public column_name(): Column_nameContext[];
    public column_name(i: number): Column_nameContext | null;
    public column_name(i?: number): Column_nameContext[] | Column_nameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Column_nameContext);
        }

        return this.getRuleContext(i, Column_nameContext);
    }
    public CLOSE_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CLOSE_PAR, 0);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_join_constraint;
    }
}


export class Compound_operatorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public UNION_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.UNION_, 0);
    }
    public ALL_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ALL_, 0);
    }
    public INTERSECT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.INTERSECT_, 0);
    }
    public EXCEPT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.EXCEPT_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_compound_operator;
    }
}


export class Update_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public UPDATE_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.UPDATE_, 0)!;
    }
    public qualified_table_name(): Qualified_table_nameContext {
        return this.getRuleContext(0, Qualified_table_nameContext)!;
    }
    public SET_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.SET_, 0)!;
    }
    public ASSIGN(): antlr.TerminalNode[];
    public ASSIGN(i: number): antlr.TerminalNode | null;
    public ASSIGN(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.ASSIGN);
    	} else {
    		return this.getToken(SqliteParser.ASSIGN, i);
    	}
    }
    public expr(): ExprContext[];
    public expr(i: number): ExprContext | null;
    public expr(i?: number): ExprContext[] | ExprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExprContext);
        }

        return this.getRuleContext(i, ExprContext);
    }
    public column_name(): Column_nameContext[];
    public column_name(i: number): Column_nameContext | null;
    public column_name(i?: number): Column_nameContext[] | Column_nameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Column_nameContext);
        }

        return this.getRuleContext(i, Column_nameContext);
    }
    public column_name_list(): Column_name_listContext[];
    public column_name_list(i: number): Column_name_listContext | null;
    public column_name_list(i?: number): Column_name_listContext[] | Column_name_listContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Column_name_listContext);
        }

        return this.getRuleContext(i, Column_name_listContext);
    }
    public with_clause(): With_clauseContext | null {
        return this.getRuleContext(0, With_clauseContext);
    }
    public OR_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OR_, 0);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public FROM_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.FROM_, 0);
    }
    public join_clause(): Join_clauseContext | null {
        return this.getRuleContext(0, Join_clauseContext);
    }
    public WHERE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.WHERE_, 0);
    }
    public returning_clause(): Returning_clauseContext | null {
        return this.getRuleContext(0, Returning_clauseContext);
    }
    public order_clause(): Order_clauseContext | null {
        return this.getRuleContext(0, Order_clauseContext);
    }
    public limit_clause(): Limit_clauseContext | null {
        return this.getRuleContext(0, Limit_clauseContext);
    }
    public ROLLBACK_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ROLLBACK_, 0);
    }
    public ABORT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ABORT_, 0);
    }
    public REPLACE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.REPLACE_, 0);
    }
    public FAIL_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.FAIL_, 0);
    }
    public IGNORE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.IGNORE_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_update_stmt;
    }
}


export class Column_name_listContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public OPEN_PAR(): antlr.TerminalNode {
        return this.getToken(SqliteParser.OPEN_PAR, 0)!;
    }
    public column_name(): Column_nameContext[];
    public column_name(i: number): Column_nameContext | null;
    public column_name(i?: number): Column_nameContext[] | Column_nameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Column_nameContext);
        }

        return this.getRuleContext(i, Column_nameContext);
    }
    public CLOSE_PAR(): antlr.TerminalNode {
        return this.getToken(SqliteParser.CLOSE_PAR, 0)!;
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_column_name_list;
    }
}


export class Qualified_table_nameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public table_name(): Table_nameContext {
        return this.getRuleContext(0, Table_nameContext)!;
    }
    public schema_name(): Schema_nameContext | null {
        return this.getRuleContext(0, Schema_nameContext);
    }
    public DOT(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DOT, 0);
    }
    public AS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.AS_, 0);
    }
    public alias(): AliasContext | null {
        return this.getRuleContext(0, AliasContext);
    }
    public INDEXED_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.INDEXED_, 0);
    }
    public BY_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.BY_, 0);
    }
    public index_name(): Index_nameContext | null {
        return this.getRuleContext(0, Index_nameContext);
    }
    public NOT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NOT_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_qualified_table_name;
    }
}


export class Vacuum_stmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public VACUUM_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.VACUUM_, 0)!;
    }
    public schema_name(): Schema_nameContext | null {
        return this.getRuleContext(0, Schema_nameContext);
    }
    public INTO_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.INTO_, 0);
    }
    public filename(): FilenameContext | null {
        return this.getRuleContext(0, FilenameContext);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_vacuum_stmt;
    }
}


export class Filter_clauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public FILTER_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.FILTER_, 0)!;
    }
    public OPEN_PAR(): antlr.TerminalNode {
        return this.getToken(SqliteParser.OPEN_PAR, 0)!;
    }
    public WHERE_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.WHERE_, 0)!;
    }
    public expr(): ExprContext {
        return this.getRuleContext(0, ExprContext)!;
    }
    public CLOSE_PAR(): antlr.TerminalNode {
        return this.getToken(SqliteParser.CLOSE_PAR, 0)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_filter_clause;
    }
}


export class Window_defnContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public OPEN_PAR(): antlr.TerminalNode {
        return this.getToken(SqliteParser.OPEN_PAR, 0)!;
    }
    public CLOSE_PAR(): antlr.TerminalNode {
        return this.getToken(SqliteParser.CLOSE_PAR, 0)!;
    }
    public base_window_name(): Base_window_nameContext | null {
        return this.getRuleContext(0, Base_window_nameContext);
    }
    public PARTITION_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.PARTITION_, 0);
    }
    public BY_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.BY_, 0);
    }
    public expr(): ExprContext[];
    public expr(i: number): ExprContext | null;
    public expr(i?: number): ExprContext[] | ExprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExprContext);
        }

        return this.getRuleContext(i, ExprContext);
    }
    public order_clause(): Order_clauseContext | null {
        return this.getRuleContext(0, Order_clauseContext);
    }
    public frame_spec(): Frame_specContext | null {
        return this.getRuleContext(0, Frame_specContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_window_defn;
    }
}


export class Over_clauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public OVER_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.OVER_, 0)!;
    }
    public window_name(): Window_nameContext | null {
        return this.getRuleContext(0, Window_nameContext);
    }
    public OPEN_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OPEN_PAR, 0);
    }
    public CLOSE_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CLOSE_PAR, 0);
    }
    public base_window_name(): Base_window_nameContext | null {
        return this.getRuleContext(0, Base_window_nameContext);
    }
    public PARTITION_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.PARTITION_, 0);
    }
    public BY_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.BY_, 0);
    }
    public expr(): ExprContext[];
    public expr(i: number): ExprContext | null;
    public expr(i?: number): ExprContext[] | ExprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExprContext);
        }

        return this.getRuleContext(i, ExprContext);
    }
    public order_clause(): Order_clauseContext | null {
        return this.getRuleContext(0, Order_clauseContext);
    }
    public frame_spec(): Frame_specContext | null {
        return this.getRuleContext(0, Frame_specContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_over_clause;
    }
}


export class Frame_specContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public frame_clause(): Frame_clauseContext {
        return this.getRuleContext(0, Frame_clauseContext)!;
    }
    public EXCLUDE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.EXCLUDE_, 0);
    }
    public NO_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NO_, 0);
    }
    public OTHERS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OTHERS_, 0);
    }
    public CURRENT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CURRENT_, 0);
    }
    public ROW_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ROW_, 0);
    }
    public GROUP_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.GROUP_, 0);
    }
    public TIES_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.TIES_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_frame_spec;
    }
}


export class Frame_clauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public RANGE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.RANGE_, 0);
    }
    public ROWS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ROWS_, 0);
    }
    public GROUPS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.GROUPS_, 0);
    }
    public frame_single(): Frame_singleContext | null {
        return this.getRuleContext(0, Frame_singleContext);
    }
    public BETWEEN_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.BETWEEN_, 0);
    }
    public frame_left(): Frame_leftContext | null {
        return this.getRuleContext(0, Frame_leftContext);
    }
    public AND_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.AND_, 0);
    }
    public frame_right(): Frame_rightContext | null {
        return this.getRuleContext(0, Frame_rightContext);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_frame_clause;
    }
}


export class Order_clauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public ORDER_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.ORDER_, 0)!;
    }
    public BY_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.BY_, 0)!;
    }
    public ordering_term(): Ordering_termContext[];
    public ordering_term(i: number): Ordering_termContext | null;
    public ordering_term(i?: number): Ordering_termContext[] | Ordering_termContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Ordering_termContext);
        }

        return this.getRuleContext(i, Ordering_termContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(SqliteParser.COMMA);
    	} else {
    		return this.getToken(SqliteParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_order_clause;
    }
}


export class Limit_clauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LIMIT_(): antlr.TerminalNode {
        return this.getToken(SqliteParser.LIMIT_, 0)!;
    }
    public expr(): ExprContext[];
    public expr(i: number): ExprContext | null;
    public expr(i?: number): ExprContext[] | ExprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExprContext);
        }

        return this.getRuleContext(i, ExprContext);
    }
    public OFFSET_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OFFSET_, 0);
    }
    public COMMA(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.COMMA, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_limit_clause;
    }
}


export class Ordering_termContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr(): ExprContext {
        return this.getRuleContext(0, ExprContext)!;
    }
    public COLLATE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.COLLATE_, 0);
    }
    public collation_name(): Collation_nameContext | null {
        return this.getRuleContext(0, Collation_nameContext);
    }
    public asc_desc(): Asc_descContext | null {
        return this.getRuleContext(0, Asc_descContext);
    }
    public NULLS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NULLS_, 0);
    }
    public FIRST_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.FIRST_, 0);
    }
    public LAST_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.LAST_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_ordering_term;
    }
}


export class Asc_descContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public ASC_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ASC_, 0);
    }
    public DESC_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DESC_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_asc_desc;
    }
}


export class Frame_leftContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr(): ExprContext | null {
        return this.getRuleContext(0, ExprContext);
    }
    public PRECEDING_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.PRECEDING_, 0);
    }
    public FOLLOWING_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.FOLLOWING_, 0);
    }
    public CURRENT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CURRENT_, 0);
    }
    public ROW_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ROW_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_frame_left;
    }
}


export class Frame_rightContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr(): ExprContext | null {
        return this.getRuleContext(0, ExprContext);
    }
    public PRECEDING_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.PRECEDING_, 0);
    }
    public FOLLOWING_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.FOLLOWING_, 0);
    }
    public CURRENT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CURRENT_, 0);
    }
    public ROW_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ROW_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_frame_right;
    }
}


export class Frame_singleContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr(): ExprContext | null {
        return this.getRuleContext(0, ExprContext);
    }
    public PRECEDING_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.PRECEDING_, 0);
    }
    public CURRENT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CURRENT_, 0);
    }
    public ROW_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ROW_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_frame_single;
    }
}


export class Error_messageContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr(): ExprContext {
        return this.getRuleContext(0, ExprContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_error_message;
    }
}


export class FilenameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr(): ExprContext {
        return this.getRuleContext(0, ExprContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_filename;
    }
}


export class Module_argumentContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public module_argument_outer(): Module_argument_outerContext[];
    public module_argument_outer(i: number): Module_argument_outerContext | null;
    public module_argument_outer(i?: number): Module_argument_outerContext[] | Module_argument_outerContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Module_argument_outerContext);
        }

        return this.getRuleContext(i, Module_argument_outerContext);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_module_argument;
    }
}


export class Module_argument_outerContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public OPEN_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OPEN_PAR, 0);
    }
    public CLOSE_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CLOSE_PAR, 0);
    }
    public UNEXPECTED_CHAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.UNEXPECTED_CHAR, 0);
    }
    public COMMA(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.COMMA, 0);
    }
    public module_argument_inner(): Module_argument_innerContext[];
    public module_argument_inner(i: number): Module_argument_innerContext | null;
    public module_argument_inner(i?: number): Module_argument_innerContext[] | Module_argument_innerContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Module_argument_innerContext);
        }

        return this.getRuleContext(i, Module_argument_innerContext);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_module_argument_outer;
    }
}


export class Module_argument_innerContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public OPEN_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OPEN_PAR, 0);
    }
    public CLOSE_PAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CLOSE_PAR, 0);
    }
    public UNEXPECTED_CHAR(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.UNEXPECTED_CHAR, 0);
    }
    public module_argument_inner(): Module_argument_innerContext[];
    public module_argument_inner(i: number): Module_argument_innerContext | null;
    public module_argument_inner(i?: number): Module_argument_innerContext[] | Module_argument_innerContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Module_argument_innerContext);
        }

        return this.getRuleContext(i, Module_argument_innerContext);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_module_argument_inner;
    }
}


export class Fallback_excluding_conflictsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public ABORT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ABORT_, 0);
    }
    public ACTION_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ACTION_, 0);
    }
    public AFTER_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.AFTER_, 0);
    }
    public ALWAYS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ALWAYS_, 0);
    }
    public ANALYZE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ANALYZE_, 0);
    }
    public ASC_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ASC_, 0);
    }
    public ATTACH_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ATTACH_, 0);
    }
    public BEFORE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.BEFORE_, 0);
    }
    public BEGIN_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.BEGIN_, 0);
    }
    public BY_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.BY_, 0);
    }
    public CASCADE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CASCADE_, 0);
    }
    public CAST_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CAST_, 0);
    }
    public COLUMN_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.COLUMN_, 0);
    }
    public CONFLICT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CONFLICT_, 0);
    }
    public CURRENT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CURRENT_, 0);
    }
    public CURRENT_DATE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CURRENT_DATE_, 0);
    }
    public CURRENT_TIME_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CURRENT_TIME_, 0);
    }
    public CURRENT_TIMESTAMP_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CURRENT_TIMESTAMP_, 0);
    }
    public DATABASE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DATABASE_, 0);
    }
    public DEFERRED_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DEFERRED_, 0);
    }
    public DESC_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DESC_, 0);
    }
    public DETACH_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DETACH_, 0);
    }
    public DO_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.DO_, 0);
    }
    public EACH_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.EACH_, 0);
    }
    public END_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.END_, 0);
    }
    public EXCEPT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.EXCEPT_, 0);
    }
    public EXCLUDE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.EXCLUDE_, 0);
    }
    public EXCLUSIVE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.EXCLUSIVE_, 0);
    }
    public EXPLAIN_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.EXPLAIN_, 0);
    }
    public FAIL_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.FAIL_, 0);
    }
    public FALSE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.FALSE_, 0);
    }
    public FIRST_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.FIRST_, 0);
    }
    public FOLLOWING_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.FOLLOWING_, 0);
    }
    public FOR_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.FOR_, 0);
    }
    public GENERATED_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.GENERATED_, 0);
    }
    public GLOB_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.GLOB_, 0);
    }
    public GROUPS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.GROUPS_, 0);
    }
    public IF_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.IF_, 0);
    }
    public IGNORE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.IGNORE_, 0);
    }
    public IMMEDIATE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.IMMEDIATE_, 0);
    }
    public INITIALLY_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.INITIALLY_, 0);
    }
    public INSTEAD_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.INSTEAD_, 0);
    }
    public INTERSECT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.INTERSECT_, 0);
    }
    public KEY_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.KEY_, 0);
    }
    public LAST_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.LAST_, 0);
    }
    public LIKE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.LIKE_, 0);
    }
    public MATCH_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.MATCH_, 0);
    }
    public MATERIALIZED_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.MATERIALIZED_, 0);
    }
    public NO_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NO_, 0);
    }
    public NULLS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NULLS_, 0);
    }
    public OF_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OF_, 0);
    }
    public OFFSET_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OFFSET_, 0);
    }
    public OTHERS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OTHERS_, 0);
    }
    public PARTITION_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.PARTITION_, 0);
    }
    public PLAN_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.PLAN_, 0);
    }
    public PRAGMA_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.PRAGMA_, 0);
    }
    public PRECEDING_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.PRECEDING_, 0);
    }
    public QUERY_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.QUERY_, 0);
    }
    public RANGE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.RANGE_, 0);
    }
    public RECURSIVE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.RECURSIVE_, 0);
    }
    public REGEXP_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.REGEXP_, 0);
    }
    public REINDEX_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.REINDEX_, 0);
    }
    public RELEASE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.RELEASE_, 0);
    }
    public RENAME_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.RENAME_, 0);
    }
    public REPLACE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.REPLACE_, 0);
    }
    public RESTRICT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.RESTRICT_, 0);
    }
    public ROLLBACK_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ROLLBACK_, 0);
    }
    public ROW_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ROW_, 0);
    }
    public ROWID_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ROWID_, 0);
    }
    public ROWS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.ROWS_, 0);
    }
    public SAVEPOINT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.SAVEPOINT_, 0);
    }
    public STORED_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.STORED_, 0);
    }
    public STRICT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.STRICT_, 0);
    }
    public TEMP_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.TEMP_, 0);
    }
    public TEMPORARY_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.TEMPORARY_, 0);
    }
    public TIES_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.TIES_, 0);
    }
    public TRIGGER_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.TRIGGER_, 0);
    }
    public TRUE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.TRUE_, 0);
    }
    public UNBOUNDED_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.UNBOUNDED_, 0);
    }
    public UNION_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.UNION_, 0);
    }
    public VACUUM_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.VACUUM_, 0);
    }
    public VIEW_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.VIEW_, 0);
    }
    public VIRTUAL_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.VIRTUAL_, 0);
    }
    public WITH_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.WITH_, 0);
    }
    public WITHIN_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.WITHIN_, 0);
    }
    public WITHOUT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.WITHOUT_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_fallback_excluding_conflicts;
    }
}


export class Join_keywordContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public CROSS_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.CROSS_, 0);
    }
    public FULL_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.FULL_, 0);
    }
    public INDEXED_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.INDEXED_, 0);
    }
    public INNER_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.INNER_, 0);
    }
    public LEFT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.LEFT_, 0);
    }
    public NATURAL_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.NATURAL_, 0);
    }
    public OUTER_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.OUTER_, 0);
    }
    public RIGHT_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.RIGHT_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_join_keyword;
    }
}


export class FallbackContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public fallback_excluding_conflicts(): Fallback_excluding_conflictsContext | null {
        return this.getRuleContext(0, Fallback_excluding_conflictsContext);
    }
    public join_keyword(): Join_keywordContext | null {
        return this.getRuleContext(0, Join_keywordContext);
    }
    public RAISE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.RAISE_, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_fallback;
    }
}


export class NameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name(): Any_nameContext {
        return this.getRuleContext(0, Any_nameContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_name;
    }
}


export class Function_nameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name_excluding_raise(): Any_name_excluding_raiseContext {
        return this.getRuleContext(0, Any_name_excluding_raiseContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_function_name;
    }
}


export class Schema_nameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name(): Any_nameContext {
        return this.getRuleContext(0, Any_nameContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_schema_name;
    }
}


export class Table_nameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name(): Any_nameContext {
        return this.getRuleContext(0, Any_nameContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_table_name;
    }
}


export class Table_or_index_nameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name(): Any_nameContext {
        return this.getRuleContext(0, Any_nameContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_table_or_index_name;
    }
}


export class Column_nameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name(): Any_nameContext {
        return this.getRuleContext(0, Any_nameContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_column_name;
    }
}


export class Column_name_excluding_stringContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name_excluding_string(): Any_name_excluding_stringContext {
        return this.getRuleContext(0, Any_name_excluding_stringContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_column_name_excluding_string;
    }
}


export class Column_aliasContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name(): Any_nameContext {
        return this.getRuleContext(0, Any_nameContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_column_alias;
    }
}


export class Collation_nameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name(): Any_nameContext {
        return this.getRuleContext(0, Any_nameContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_collation_name;
    }
}


export class Foreign_tableContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name(): Any_nameContext {
        return this.getRuleContext(0, Any_nameContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_foreign_table;
    }
}


export class Index_nameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name(): Any_nameContext {
        return this.getRuleContext(0, Any_nameContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_index_name;
    }
}


export class Trigger_nameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name(): Any_nameContext {
        return this.getRuleContext(0, Any_nameContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_trigger_name;
    }
}


export class View_nameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name(): Any_nameContext {
        return this.getRuleContext(0, Any_nameContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_view_name;
    }
}


export class Module_nameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name(): Any_nameContext {
        return this.getRuleContext(0, Any_nameContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_module_name;
    }
}


export class Pragma_nameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name(): Any_nameContext {
        return this.getRuleContext(0, Any_nameContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_pragma_name;
    }
}


export class Savepoint_nameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name(): Any_nameContext {
        return this.getRuleContext(0, Any_nameContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_savepoint_name;
    }
}


export class Table_aliasContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name(): Any_nameContext {
        return this.getRuleContext(0, Any_nameContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_table_alias;
    }
}


export class Table_alias_excluding_joinsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name_excluding_joins(): Any_name_excluding_joinsContext {
        return this.getRuleContext(0, Any_name_excluding_joinsContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_table_alias_excluding_joins;
    }
}


export class Window_nameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name(): Any_nameContext {
        return this.getRuleContext(0, Any_nameContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_window_name;
    }
}


export class AliasContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name(): Any_nameContext {
        return this.getRuleContext(0, Any_nameContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_alias;
    }
}


export class Base_window_nameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name(): Any_nameContext {
        return this.getRuleContext(0, Any_nameContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_base_window_name;
    }
}


export class Table_function_nameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public any_name(): Any_nameContext {
        return this.getRuleContext(0, Any_nameContext)!;
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_table_function_name;
    }
}


export class Any_name_excluding_raiseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.IDENTIFIER, 0);
    }
    public fallback_excluding_conflicts(): Fallback_excluding_conflictsContext | null {
        return this.getRuleContext(0, Fallback_excluding_conflictsContext);
    }
    public join_keyword(): Join_keywordContext | null {
        return this.getRuleContext(0, Join_keywordContext);
    }
    public STRING_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.STRING_LITERAL, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_any_name_excluding_raise;
    }
}


export class Any_name_excluding_joinsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.IDENTIFIER, 0);
    }
    public fallback_excluding_conflicts(): Fallback_excluding_conflictsContext | null {
        return this.getRuleContext(0, Fallback_excluding_conflictsContext);
    }
    public RAISE_(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.RAISE_, 0);
    }
    public STRING_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.STRING_LITERAL, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_any_name_excluding_joins;
    }
}


export class Any_name_excluding_stringContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.IDENTIFIER, 0);
    }
    public fallback(): FallbackContext | null {
        return this.getRuleContext(0, FallbackContext);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_any_name_excluding_string;
    }
}


export class Any_nameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IDENTIFIER(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.IDENTIFIER, 0);
    }
    public fallback(): FallbackContext | null {
        return this.getRuleContext(0, FallbackContext);
    }
    public STRING_LITERAL(): antlr.TerminalNode | null {
        return this.getToken(SqliteParser.STRING_LITERAL, 0);
    }
    public override get ruleIndex(): number {
        return SqliteParser.RULE_any_name;
    }
}
